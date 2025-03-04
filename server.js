// server.js
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ARTICLES_DB_ID = process.env.ARTICLES_DB_ID;
const NOTION_VERSION = '2022-06-28';

app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Endpoint for querying articles from Notion
app.get('/api/articles', async (req, res) => {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${ARTICLES_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching Notion articles:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint for querying debates from Notion
app.post('/api/debates', async (req, res) => {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${ARTICLES_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: "Type",
          select: { equals: "Debate" }
        }
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching Notion debates:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint for fetching a single page's details
app.get('/api/pages/:id', async (req, res) => {
  const articleId = req.params.id;
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${articleId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching page from Notion:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint for fetching block children of a page
app.get('/api/blocks/:id/children', async (req, res) => {
  const articleId = req.params.id;
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${articleId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching blocks from Notion:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});