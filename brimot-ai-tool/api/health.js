module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    ok: true,
    mode: "vercel",
    deepseekKeyLoaded: Boolean(process.env.BRIMOT_DEEPSEEK_API_KEY),
    openaiKeyLoaded: Boolean(process.env.BRIMOT_OPENAI_API_KEY)
  });
};
