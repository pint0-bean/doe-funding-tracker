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

  "federal education grants rescinded frozen 2025",
];

const SYSTEM_PROMPT = `You are a policy research assistant tracking federal education funding changes under the Trump administration.
For each topic provided, search for news articles. Return a MAXIMUM of 3 articles per topic — pick only the most recent and relevant ones.
Return clean HTML sections (no wrapping tags, no <html>, <body>, or <style>) with:
- For each topic: a <h3> section header using only the topic name — no numbers, no prefixes
- For each article: a <p><strong><a href="URL">Headline</a></strong></p> followed by a <p> with a 2-3 sentence plain-language summary
- A <p class="source"> with the publication name, author if available, date, and full URL as a clickable link
- Within each topic, order articles from newest to oldest by publication date
IMPORTANT: Return ONLY the raw HTML sections. Do not include any introduction, preamble, closing remarks, horizontal rules, or markdown. Start directly with the first <h3> tag.`;

const delay = ms => new Promise(res => setTimeout(res, ms));

function wrapInTemplate(content, date) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FDFDFF;font-family:Georgia,'Times New Roman',serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFDFF;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;">

        <!-- Header Banner -->
        <tr>
          <td style="background-color:#4D6A6D;padding:28px 40px 20px;border-bottom:4px solid #C9ADA1;">
            <img src="https://raw.githubusercontent.com/pint0-bean/doe-funding-tracker/main/SDEEC_Logo_Horizontal_White_No_BG.webp" alt="SDEEC Logo" style="max-width:260px;width:100%;display:block;margin-bottom:16px;">
            <div style="font-size:22px;font-weight:bold;color:#FDFDFF;line-height:1.2;">DOE Funding Tracker</div>
            <div style="font-size:12px;color:#E0EAEB;margin-top:6px;">${date} &nbsp;·&nbsp; Biweekly Policy Digest</div>
          </td>
        </tr>

        <!-- Intro Bar -->
        <tr>
          <td style="background-color:#E8EEEF;padding:10px 40px;border-bottom:1px solid #C9ADA1;">
            <p style="margin:0;font-size:13px;color:#4D6A6D;letter-spacing:0.3px;">Tracking federal education funding developments under the Trump administration.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#FDFDFF;padding:32px 40px;">
            <style>
              h3 { color:#4D6A6D; font-size:15px; text-transform:uppercase; letter-spacing:1.5px; border-bottom:2px solid #E8EEEF; padding-bottom:8px; margin-top:32px; }
              a { color:#4D6A6D; font-size:16px; font-weight:bold; }
              p { color:#141313; font-size:14px; line-height:1.7; }
              .source { font-size:12px; color:#A0A083; margin-top:4px; }
            </style>
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#4D6A6D;padding:20px 40px;border-top:4px solid #C9ADA1;">
            <p style="margin:0;font-size:12px;color:#FDFDFF;line-height:1.8;">
              Generated automatically for policy monitoring by<br>
              <a href="https://sdeducationequity.org" style="color:#141313;font-size:12px;font-weight:normal;text-decoration:none;">SDEEC — South Dakota Education Equity Coalition</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

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
  return wrapInTemplate(`${html1}${html2}`, date);
}

async function sendEmail(html) {
  console.log('📬 Recipient:', process.env.RECIPIENT_EMAILS || 'UNDEFINED — secret not found');
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
