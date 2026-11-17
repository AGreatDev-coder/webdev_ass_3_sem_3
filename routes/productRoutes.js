const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  deleteProduct,
  updateStock
} = require('../controllers/productController');

// Collection routes
router.route('/')
  .post(createProduct)
  .get(getProducts);

// Report & aggregation routes (must precede parameterized /:id routes)
router.get('/low-stock', getLowStockProducts);
router.get('/summary', getCategorySummary);

// Stock adjustment route
router.patch('/:id/stock', updateStock);

// Single item routes
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

module.exports = router;

