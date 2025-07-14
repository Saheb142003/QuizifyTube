import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

import "./App.css";

// Constants
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const DEFAULT_WORD_LIMIT = 70;
const DEFAULT_QUESTIONS_COUNT = 5;

function App() {
  // State management
  const [state, setState] = useState({
    url: "",
    loading: false,
    result: null,
    error: "",
    transcript: [],
    displayText: "",
    summary: "",
    fallbackAvailable: false,
    useFallback: false,
    viewMode: "transcript",
    wordLimit: DEFAULT_WORD_LIMIT,
    quiz: [],
    numQuestions: DEFAULT_QUESTIONS_COUNT,
    difficulty: "medium",
    parsedQuiz: [],
    currentQuestion: 0,
    selectedOptions: {},
    score: 0,
  });

  // Derived state
  const embedUrl = getEmbedUrl(state.url);

  // Memoized handlers
  const resetState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      result: null,
      transcript: [],
      displayText: "",
      summary: "",
      quiz: [],
      error: "",
      fallbackAvailable: false,
      useFallback: false,
      parsedQuiz: [],
      currentQuestion: 0,
      selectedOptions: {},
      score: 0,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      resetState();
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const res = await axios.post(`${API_BASE_URL}/analyze`, {
          url: state.url,
        });
        setState((prev) => ({
          ...prev,
          result: res.data,
          transcript: res.data.full_transcript || [],
          viewMode: "transcript",
          loading: false,
        }));
      } catch (err) {
        const msg = err.response?.data?.error || "Something went wrong!";
        const errorCode = err.response?.data?.code || "";

        setState((prev) => ({
          ...prev,
          error: msg,
          loading: false,
          fallbackAvailable:
            errorCode === "NO_TRANSCRIPT" ||
            msg.toLowerCase().includes("transcript fetch failed"),
        }));
      }
    },
    [state.url, resetState]
  );

  const generateWithWhisper = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const res = await axios.post(`${API_BASE_URL}/api/fallback-transcript`, {
        url: state.url,
      });
      setState((prev) => ({
        ...prev,
        transcript: [res.data.transcript],
        useFallback: true,
        viewMode: "transcript",
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: "Whisper failed: " + (err.message || "Unknown error"),
        loading: false,
      }));
    }
  }, [state.url]);

  const handleSummarize = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, summary: "" }));

    try {
      const res = await axios.post(`${API_BASE_URL}/api/summarize`, {
        transcript: state.transcript.join(" "),
        word_limit: state.wordLimit,
      });
      setState((prev) => ({
        ...prev,
        summary: res.data.summary,
        loading: false,
      }));
    } catch (error) {
      console.error("Summary error:", error);
      setState((prev) => ({
        ...prev,
        summary: "❌ Failed to summarize. Please try again.",
        loading: false,
      }));
    }
  }, [state.transcript, state.wordLimit]);

  const parseQuiz = useCallback((quizString) => {
    const rawQuestions = quizString
      .split(/\n(?=Q\d+\.)/)
      .filter((q) => q.trim().length > 0);

    const structured = rawQuestions.map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      const questionLine = lines[0].replace(/^Q\d+\.\s*/, "");
      const options = lines.slice(1, 5).map((line) => {
        const [label, ...textParts] = line.split(".");
        return { label: label.trim(), text: textParts.join(".").trim() };
      });
      const answerLine = lines.find((l) => l.startsWith("Answer:"));
      const correct = answerLine ? answerLine.split(":")[1].trim() : null;
      return { question: questionLine, options, correct };
    });

    return { rawQuestions, structured };
  }, []);

  const handleQuizify = useCallback(async () => {
    if (!state.summary) {
      alert("Please summarize first!");
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      quiz: [],
      currentQuestion: 0,
      score: 0,
      selectedOptions: {},
    }));

    try {
      const res = await axios.post(`${API_BASE_URL}/api/quiz`, {
        summary: state.summary,
        num_questions: state.numQuestions,
        difficulty: state.difficulty,
      });

      const { rawQuestions, structured } = parseQuiz(res.data.quiz);
      setState((prev) => ({
        ...prev,
        quiz: rawQuestions,
        parsedQuiz: structured,
        loading: false,
      }));
    } catch (quizException) {
      console.error("Quizify Error:", quizException);
      setState((prev) => ({
        ...prev,
        quiz: ["❌ Failed to generate quiz."],
        loading: false,
      }));
    }
  }, [state.summary, state.numQuestions, state.difficulty, parseQuiz]);

  const handleOptionSelect = useCallback((qIndex, option) => {
    setState((prev) => ({
      ...prev,
      selectedOptions: { ...prev.selectedOptions, [qIndex]: option },
    }));
  }, []);

  const handleNextQuestion = useCallback(() => {
    const current = state.parsedQuiz[state.currentQuestion];
    const isCorrect =
      state.selectedOptions[state.currentQuestion] === current.correct;

    setState((prev) => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      currentQuestion: prev.currentQuestion + 1,
    }));
  }, [state.parsedQuiz, state.currentQuestion, state.selectedOptions]);

  // Effects
  useEffect(() => {
    if (state.viewMode === "transcript" && state.transcript.length > 0) {
      const fullText = state.transcript.join(" ");
      const totalDuration = 5000;
      const totalChars = fullText.length;
      const intervalTime = 16;
      const charsPerTick = Math.ceil(
        totalChars / (totalDuration / intervalTime)
      );

      let i = 0;
      const interval = setInterval(() => {
        i += charsPerTick;
        if (i >= totalChars) {
          setState((prev) => ({ ...prev, displayText: fullText }));
          clearInterval(interval);
        } else {
          setState((prev) => ({ ...prev, displayText: fullText.slice(0, i) }));
        }
      }, intervalTime);

      return () => clearInterval(interval);
    }
  }, [state.viewMode, state.transcript]);

  // Helper functions
  function getEmbedUrl(youtubeUrl) {
    const videoIdMatch = youtubeUrl.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/
    );
    return videoIdMatch
      ? `https://www.youtube.com/embed/${videoIdMatch[1]}`
      : "";
  }

  return (
    <div className="app">
      <div className="videoPanel">
        <div className="videoBox">
          {embedUrl && (
            <iframe
              width="600"
              height="400"
              src={embedUrl}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          )}
        </div>

        {state.quiz.length > 0 && (
          <div className="quiz-section">
            <h3>🧠 Quiz</h3>

            {state.currentQuestion < state.quiz.length ? (
              <div className="question-box">
                <p>{state.parsedQuiz[state.currentQuestion]?.question}</p>
                <ul className="options-list">
                  {state.parsedQuiz[state.currentQuestion]?.options.map(
                    (opt, idx) => (
                      <li
                        key={idx}
                        className={`option ${
                          state.selectedOptions[state.currentQuestion] ===
                          opt.label
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleOptionSelect(state.currentQuestion, opt.label)
                        }
                      >
                        {opt.label}. {opt.text}
                      </li>
                    )
                  )}
                </ul>
                <button onClick={handleNextQuestion}>
                  {state.currentQuestion === state.quiz.length - 1
                    ? "Submit Quiz"
                    : "Next"}
                </button>
              </div>
            ) : (
              <div className="quiz-result">
                <h4>🎉 Quiz Completed</h4>
                <p>
                  You scored {state.score} out of {state.quiz.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="processPanel">
        <h1>QuizifyTube 🎓</h1>

        <form onSubmit={handleSubmit} className="analyze-row">
          <input
            type="text"
            placeholder="Paste YouTube video URL..."
            value={state.url}
            onChange={(e) =>
              setState((prev) => ({ ...prev, url: e.target.value }))
            }
            required
          />
          <button type="submit">Analyze</button>
          {state.result && (
            <span
              className={`edu-tag ${state.result.educational ? "yes" : "no"}`}
              title="Educational content check"
            >
              {state.result.educational
                ? "✅ Educational"
                : "❌ Not Educational"}
            </span>
          )}
        </form>

        {state.loading && <div className="loader">⏳ Processing...</div>}
        {state.error && <div className="error">{state.error}</div>}

        {state.fallbackAvailable && !state.useFallback && (
          <div className="fallback-box">
            <p>⚠️ No official transcript available.</p>
            <button onClick={generateWithWhisper} className="toggle-btn">
              Generate with Whisper (AI)
            </button>
          </div>
        )}

        {state.result && state.transcript.length > 0 && (
          <>
            <div className="button-row">
              <button
                className={`toggle-btn ${
                  state.viewMode === "transcript" ? "active" : ""
                }`}
                onClick={() =>
                  setState((prev) => ({ ...prev, viewMode: "transcript" }))
                }
              >
                📖 Show Transcript
              </button>

              <div className="summarize-group">
                <button
                  className={`toggle-btn ${
                    state.viewMode === "summary" ? "active" : ""
                  }`}
                  onClick={async () => {
                    if (!state.summary) await handleSummarize();
                    setState((prev) => ({ ...prev, viewMode: "summary" }));
                  }}
                >
                  ✨ Summarize
                  <input
                    type="number"
                    min="20"
                    max="500"
                    value={state.wordLimit}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        wordLimit: Number(e.target.value),
                      }))
                    }
                    className="word-limit-input-inline"
                    title="Set word limit"
                  />
                </button>
              </div>

              <div className="quiz-group">
                <button className="toggle-btn" onClick={handleQuizify}>
                  🧠 Quizify
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={state.numQuestions}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        numQuestions: Number(e.target.value),
                      }))
                    }
                    className="word-limit-input-inline"
                    title="No. of questions"
                  />
                </button>

                <select
                  value={state.difficulty}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      difficulty: e.target.value,
                    }))
                  }
                  className="difficulty-select"
                  title="Select difficulty"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {(state.viewMode === "transcript" ||
              state.viewMode === "summary") && (
              <div className="transcript-box">
                <h3>
                  {state.viewMode === "transcript"
                    ? "📖 Transcript"
                    : "📝 Summary"}
                </h3>
                <pre>
                  {state.viewMode === "transcript"
                    ? state.displayText
                    : state.summary}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
