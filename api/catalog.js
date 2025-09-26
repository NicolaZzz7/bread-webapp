import { google } from 'googleapis';

export default async (req, res) => {
  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
        project_id: projectId,
      },
      scopes: scopes,
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const spreadsheetId = '1Rs2OVq7Ix4gjpsRI-w515ON3q_tLsKDsUIRmBloEZcw';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:H',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No data found in spreadsheet' });
    }

    const catalog = {};
    for (let i = 1; i < rows.length; i++) {
      const [id, name, ingredients, price_100, price_500, price_750, addons, prep_time] = rows[i];
      const breadId = id.toLowerCase().replace(' ', '_');
      catalog[breadId] = {
        name: name || 'Без названия',
        ingredients: ingredients || '',
        prices: {
          '100': price_100 ? parseInt(price_100) : 0,
          '500': price_500 ? parseInt(price_500) : 0,
          '750': price_750 ? parseInt(price_750) : 0,
        },
        addons: addons || '',
        prep_time: prep_time || '',
      };
    }

    res.status(200).json(catalog);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch catalog data', details: error.message });
  }
};