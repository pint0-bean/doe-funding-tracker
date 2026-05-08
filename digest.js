// digest.js — DOE Funding Tracker (updated)
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

const SYSTEM_PROMPT = `You are a policy research assistant tracking federal education funding changes under the Trump administration.
For each topic provided, search for the 2-3 most recent relevant news articles.
Return well-formatted HTML sections (no <html> or <body> tags) with:
- For each topic: a <h3> section header, then for each article: a linked headline (hyperlinked to the full article URL), a 2-3 sentence plain-language summary, and a "Source:" line with the publication name, author if available, date, and the full URL as a clickable link
Be factual, neutral, and clear. Always include the full source URL for every article. Return ONLY the HTML sections with no preamble or markdown fences.`;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function searchTopics(topics) {
  const topicList = topics.map((kw, i) => `${i + 1}. ${kw}`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Search for recent news on each topic:\n${topicList}` }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Anthropic API error: ${data.error.message}`);

  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function getDigest() {
  const mid = Math.ceil(TOPICS.length / 2);
  const batch1 = TOPICS.slice(0, mid);
  const batch2 = TOPICS.slice(mid);

  console.log(`📦 Searching batch 1 (${batch1.length} topics)...`);
  const html1 = await searchTopics(batch1);

  console.log('⏳ Waiting between batches...');
  await delay(65000); // wait 65 seconds to respect rate limit

  console.log(`📦 Searching batch 2 (${batch2.length} topics)...`);
  const html2 = await searchTopics(batch2);

  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <h2>DOE Funding Tracker — ${date}</h2>
    <p>This biweekly digest tracks federal education funding developments.</p>
    ${html1}
    ${html2}
    <p><em>This digest is generated automatically for policy monitoring by SDEEC (sdeducationequity.org).</em></p>
  `;
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
    to: process.env.RECIPIENT_EMAILS,
    subject: `DOE Funding Tracker — ${date}`,
    html,
  });

  console.log(`✅ Digest sent to ${process.env.RECIPIENT_EMAILS}`);
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
