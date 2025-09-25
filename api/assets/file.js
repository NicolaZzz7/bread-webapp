export default async function handler(req, res) {
  const file = req.query.file;

  if (file === 'style.css') {
    res.setHeader('Content-Type', 'text/css');
    // Верни содержимое style.css
  } else if (file === 'script.js') {
    res.setHeader('Content-Type', 'application/javascript');
    // Верни содержимое script.js
  }
}