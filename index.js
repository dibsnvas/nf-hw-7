const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const fs = require('fs').promises;
const cron = require('node-cron');
require('dotenv').config();

const app = express();

async function fetchData(url, retries = 3) {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000, 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    return cheerio.load(data);
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${3 - retries + 1})`);
      return fetchData(url, retries - 1);
    } else {
      throw error;
    }
  }
}

async function parseProduct(url) {
  const $ = await fetchData(url);

  const products = [];

  $(".grid-item").each((index, element) => {
    const title = $(element)
      .find(".glass-product-card__title")
      .text()
      .trim();
    const link = $(element).find("a").attr("href");
    let price = $(element)
      .find(".glass-product-card__full-price")
      .text()
      .trim();

    if (!price) {
      price = $(element)
        .find(".glass-product-card__sale-price")
        .text()
        .trim();
    }

    products.push({
      title,
      price,
      link: `https://www.adidas.com${link}`,
    });
  });

  return products;
}

async function saveProductsToFile(products, filename) {
  const data = JSON.stringify(products, null, 2);
  await fs.writeFile(filename, data, 'utf8');
  console.log(`Data saved to ${filename}`);
}

async function fetchAndSaveProducts() {
  const url = 'https://www.adidas.com/us/women-athletic_sneakers';
  try {
    const products = await parseProduct(url);
    await saveProductsToFile(products, 'products.json');
  } catch (error) {
    console.error('Failed to fetch and save products:', error.message);
  }
}

cron.schedule('0 * * * *', fetchAndSaveProducts); 

app.get('/products', async (req, res) => {
  try {
    const data = await fs.readFile('products.json', 'utf8');
    const products = JSON.parse(data);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  fetchAndSaveProducts(); 
});
