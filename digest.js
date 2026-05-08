// digest.js — DOE Funding Tracker
// Searches for recent news and emails a digest via Gmail
// Runs automatically via GitHub Actions every two weeks

const nodemailer = require('nodemailer');

const TOPICS = [
  "Department of Education Trump dismantlement DOGE 2025",
  "Title I education funding cuts Trump 2025",
  "Impact Aid federal education funding cuts 2025",
  "Bureau of Indian Education school funding cuts 2025",
  "IDEA special education federal funding cuts 2025",
  "Title VI Native American education funding 2025",
  "McKinney-Vento homeless students education funding cuts",
  "federal education grants rescinded frozen 2025",
];

async function getDigest() {
  const topicList = TOPICS.map((kw, i) => `${i + 1}. ${kw}`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: `You are a policy research assistant tracking federal education funding changes under the Trump administration.
For each topic provided, search for the 2-3 most recent relevant news articles.
Return a well-formatted HTML email digest with:
- A <h2> title: "DOE Funding Tracker — [today's date]"
- A brief intro: "This biweekly digest tracks federal education funding developments."
- For each topic: a <h3> section header, then for each article: a linked headline, 2-3 sentence plain-language summary, and source name + date
- A closing line: "This digest is generated automatically for policy monitoring by SDEEC (sdeducationequity.org)."
Be factual, neutral, and clear. Return ONLY the HTML with no preamble or markdown fences.`,
      messages: [{ role: 'user', content: `Search for recent news on each topic:\n${topicList}` }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Anthropic API error: ${data.error.message}`);

  const html = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  if (!html) throw new Error('No digest content was generated.');
  return html;
}

async function sendEmail(html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const date = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  await transporter.sendMail({
    from: `"SDEEC DOE Tracker" <${process.env.GMAIL_USER}>`,
    to: process.env.RECIPIENT_EMAIL,
    subject: `DOE Funding Tracker — ${date}`,
    html,
  });

  console.log(`✅ Digest sent to ${process.env.RECIPIENT_EMAIL}`);
}

(async () => {
  try {
    console.log('🔍 Fetching and summarizing news...');
    const html = await getDigest();
    console.log('📧 Sending email...');
    await sendEmail(html);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
