import { google } from 'googleapis';

export default async (req, res) => {
  try {
    // Получаем переменные окружения
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

      // Формируем объект цен, исключая нулевые и невалидные значения
      const prices = {};
      if (price_100 && price_100 !== '-' && !isNaN(parseInt(price_100))) prices['100'] = parseInt(price_100);
      if (price_500 && price_500 !== '-' && !isNaN(parseInt(price_500))) prices['500'] = parseInt(price_500);
      if (price_750 && price_750 !== '-' && !isNaN(parseInt(price_750))) prices['750'] = parseInt(price_750);

      // Обрабатываем добавки
      const hasAddons = addons && addons.trim() !== '' && addons !== '-';
      const addonsPrice = hasAddons ? 50 : 0;
      const addonsText = hasAddons ? 'семена льна, семечки, тыква (+50₽)' : '';

      catalog[breadId] = {
        name: name || 'Без названия',
        ingredients: ingredients || '',
        prices: prices,
        hasAddons: hasAddons,
        addonsPrice: addonsPrice,
        addonsText: addonsText,
        prep_time: prep_time || '1-2 дня',
        baseAddonsPrice: 50 // Фиксированная цена за добавки
      };
    }

    res.status(200).json(catalog);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch catalog data', details: error.message });
  }
};