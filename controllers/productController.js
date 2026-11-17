const mongoose = require('mongoose');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @desc    Create a new product
// @route   POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { category, supplier, minPrice, maxPrice, lowStock, sortBy, order, sort } = req.query;

  const filter = {};

  if (category) {
    filter.category = { $regex: category, $options: 'i' };
  }

  if (supplier) {
    filter.supplier = { $regex: supplier, $options: 'i' };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      const min = Number(minPrice);
      if (isNaN(min) || min < 0) {
        res.status(400);
        throw new Error('minPrice must be a non-negative number');
      }
      filter.price.$gte = min;
    }
    if (maxPrice !== undefined) {
      const max = Number(maxPrice);
      if (isNaN(max) || max < 0) {
        res.status(400);
        throw new Error('maxPrice must be a non-negative number');
      }
      filter.price.$lte = max;
    }
    if (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte) {
      res.status(400);
      throw new Error('minPrice cannot be greater than maxPrice');
    }
  }

  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$quantity', '$reorderLevel'] };
  }

  // Sorting
  let sortOptions = { createdAt: -1 };
  const allowedSortFields = ['name', 'price', 'quantity', 'createdAt', 'supplier', 'category'];

  if (sortBy && allowedSortFields.includes(sortBy)) {
    const sortOrder = order && order.toLowerCase() === 'asc' ? 1 : -1;
    sortOptions = { [sortBy]: sortOrder };
  } else if (sort) {
    const isDesc = sort.startsWith('-');
    const field = isDesc ? sort.substring(1) : sort;
    if (allowedSortFields.includes(field)) {
      sortOptions = { [field]: isDesc ? -1 : 1 };
    }
  }

  // Pagination
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  if (req.query.page !== undefined && (isNaN(page) || page < 1)) {
    res.status(400);
    throw new Error('Page must be a positive integer');
  }

  if (req.query.limit !== undefined && (isNaN(limit) || limit < 1)) {
    res.status(400);
    throw new Error('Limit must be a positive integer');
  }

  page = page || 1;
  limit = limit || 10;
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.status(200).json({
    total,
    page,
    totalPages,
    count: products.length,
    products
  });
});

// @desc    Get low-stock alert report
// @route   GET /api/products/low-stock
const getLowStockProducts = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.find({
    $expr: { $lte: ['$quantity', '$reorderLevel'] }
  });

  res.status(200).json({
    count: lowStockItems.length,
    lowStockItems
  });
});

// @desc    Get category-wise inventory summary using MongoDB aggregation
// @route   GET /api/products/summary
const getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        avgPrice: { $avg: '$price' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.status(200).json({
    categories: summary.length,
    summary
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ID format: ${id}`);
  }

  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json(product);
});

// @desc    Update product details
// @route   PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ID format: ${id}`);
  }

  const product = await Product.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json(product);
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ID format: ${id}`);
  }

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({
    message: 'Product deleted',
    id
  });
});

// @desc    Adjust stock level (restock or sale)
// @route   PATCH /api/products/:id/stock
const updateStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { change } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ID format: ${id}`);
  }

  if (change === undefined || typeof change !== 'number' || !Number.isInteger(change) || change === 0) {
    res.status(400);
    throw new Error('Stock change must be a non-zero integer');
  }

  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (product.quantity + change < 0) {
    res.status(400);
    throw new Error(`Insufficient stock: cannot reduce quantity (${product.quantity}) by ${Math.abs(change)}`);
  }

  product.quantity += change;
  await product.save();

  res.status(200).json({
    message: 'Stock updated',
    product
  });
});

module.exports = {
  createProduct,
  getProducts,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  deleteProduct,
  updateStock
};

