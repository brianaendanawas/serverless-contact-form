// index.js — Runtime: Node.js 16.x
const AWS = require("aws-sdk");
const ses = new AWS.SES({}); // Region picked up from Lambda environment

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",                  // For stricter security, replace * with your S3 website URL
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST"
};

exports.handler = async (event) => {
  // If API Gateway sends an OPTIONS preflight to Lambda (usually it handles it itself), respond OK:
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  }

  // Parse and validate body
  let payload = {};
  try {
    payload = event?.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Invalid JSON" }) };
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const message = (payload.message || "").trim();

  if (!name || !email || !message) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "All fields are required." }) };
  }

  const sender = process.env.SENDER_EMAIL;      // must be SES-verified in this region if SES is in sandbox
  const recipient = process.env.RECIPIENT_EMAIL || sender; // recipient must also be verified in SES sandbox

  const params = {
    Source: sender,
    Destination: { ToAddresses: [recipient] },
    Message: {
      Subject: { Data: `New contact form from ${name}` },
      Body: {
        Text: { Data: `From: ${name} <${email}>\n\nMessage:\n${message}` }
      }
    }
  };

  try {
    await ses.sendEmail(params).promise();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: "Email sent successfully!" }) };
  } catch (err) {
    console.error("SES error:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: "Email failed", error: err.message }) };
  }
};
