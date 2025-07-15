const express = require("express");
const cors = require("cors");
const { spawnSync } = require("child_process");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // safer than '*', but defaults to it
    credentials: true,
  })
);

app.use(express.json());

// Utility function to run Python scripts
const runPython = (script, args = []) => {
  const result = spawnSync("python", [script, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  const stdout = result.stdout?.trim() || "";
  const stderr = result.stderr?.trim() || "";

  return { stdout, stderr };
};

app.get("/",(req,resp)=>{
  console.log("server is running on render",process.env.FRONTEND_URL);
  resp.send("hello world")
})


// ========== /analyze ==========
app.post("/analyze", (req, res) => {
  const { url } = req.body;
  if (!url)
    return res.status(400).json({
      error: "No URL provided",
      stage: "input_validation",
    });

  try {
    // Step 1: Fetch Transcript
    const { stdout: fetchOutput, stderr: fetchError } = runPython(
      "fetch_transcript.py",
      [url]
    );

    if (fetchError) {
      console.error("❗ Error while fetching transcript:", fetchError);
    }

    let transcript;
    try {
      transcript = JSON.parse(fetchOutput);
    } catch (err) {
      console.error("❌ Invalid JSON from fetch_transcript.py:", fetchOutput);
      return res.status(500).json({
        error: "Transcript fetch failed. Invalid or corrupt JSON response.",
        stage: "transcript_fetch",
        message: err.message,
        suggestion:
          "Try using fallback transcript method (Whisper/AssemblyAI).",
        code: "NO_TRANSCRIPT",
      });
    }

    if (transcript.error) {
      console.error("❌ fetch_transcript.py error:", transcript.error);
      return res.status(500).json({
        error: transcript.error,
        stage: "transcript_fetch",
        suggestion:
          "Try using fallback transcript method (Whisper/AssemblyAI).",
        code: "NO_TRANSCRIPT",
      });
    }

    if (!Array.isArray(transcript) || transcript.length === 0) {
      console.error("❌ Transcript is empty or not a valid array.");
      return res.status(400).json({
        error: "Transcript fetched but is empty or malformed.",
        stage: "transcript_fetch",
        code: "NO_TRANSCRIPT",
        suggestion:
          "Try using fallback transcript method (Whisper/AssemblyAI).",
      });
    }

    // Step 2: Educational Content Check
    const { stdout: analysisOutput, stderr: analysisError } = runPython(
      "check_educational.py",
      [JSON.stringify(transcript)]
    );

    if (analysisError) {
      console.error("❗ Error during analysis:", analysisError);
    }

    if (!analysisOutput) {
      console.error("❌ No output from check_educational.py");
      return res.status(500).json({
        error: "Transcript analysis returned no output.",
        stage: "education_analysis",
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisOutput);
    } catch (err) {
      console.error(
        "❌ Invalid JSON from check_educational.py:",
        analysisOutput
      );
      return res.status(500).json({
        error: "Failed to parse analysis output.",
        message: err.message,
        stage: "education_analysis",
      });
    }

    if (analysis.error) {
      console.error("❌ Analysis script returned error:", analysis.error);
      return res.status(500).json({
        error: analysis.error,
        stage: "education_analysis",
      });
    }

    // ✅ Success
    return res.json({
      ...analysis,
      full_transcript: transcript,
    });
  } catch (err) {
    console.error("❌ Unhandled server error:", err);
    return res.status(500).json({
      error: "Internal server error.",
      message: err.message,
      stage: "server",
    });
  }
});

// ========== /api/fallback-transcript ==========
app.post("/api/fallback-transcript", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const { stdout, stderr } = runPython("assemblyai_transcribe.py", [url]);

    if (stderr) {
      console.error("❗ AssemblyAI Error:", stderr);
    }

    const outputLines = stdout.split("\n").reverse();
    const jsonLine = outputLines.find((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

    if (!jsonLine) {
      return res
        .status(500)
        .json({ error: "AssemblyAI returned invalid output" });
    }

    const parsed = JSON.parse(jsonLine);
    if (parsed.error) {
      return res.status(500).json({ error: parsed.error });
    }

    return res.json({ transcript: parsed.transcript });
  } catch (err) {
    console.error("AssemblyAI fallback error:", err);
    res
      .status(500)
      .json({ error: "AssemblyAI failed to transcribe the video." });
  }
});

// ========== /api/summarize ==========
app.post("/api/summarize", (req, res) => {
  const { transcript, word_limit } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "Transcript is required" });
  }

  try {
    const { stdout, stderr } = runPython("summarizer.py", [
      transcript,
      word_limit?.toString() || "70",
    ]);

    if (stderr) {
      console.error("❗ Summarizer Error:", stderr);
    }

    const lines = stdout.split("\n").reverse();
    const jsonLine = lines.find((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

    if (!jsonLine) {
      return res
        .status(500)
        .json({ error: "No valid response from summarizer" });
    }

    const parsed = JSON.parse(jsonLine);
    if (parsed.error) {
      return res.status(500).json({ error: parsed.error });
    }

    return res.json({ summary: parsed.summary });
  } catch (e) {
    console.error("Summarization error:", e);
    return res.status(500).json({ error: "Summarization failed." });
  }
});

// ========== /api/quiz ==========
app.post("/api/quiz", (req, res) => {
  const { summary, num_questions, difficulty } = req.body;
  if (!summary) return res.status(400).json({ error: "Summary required" });

  try {
    const { stdout, stderr } = runPython("quizzify.py", [
      summary,
      num_questions,
      difficulty,
    ]);

    if (stderr) {
      console.error("❗ Quiz Error:", stderr);
    }

    const lines = stdout.split("\n").reverse();
    const jsonLine = lines.find((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

    if (!jsonLine) {
      return res.status(500).json({ error: "Quiz generation failed" });
    }

    const parsed = JSON.parse(jsonLine);
    if (parsed.error) return res.status(500).json({ error: parsed.error });

    return res.json({ quiz: parsed.quiz });
  } catch (err) {
    console.error("Quizify error:", err);
    return res.status(500).json({ error: "Quizify process failed." });
  }
});

// ========== Start Server ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
