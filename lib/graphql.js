const { buildSchema } = require('graphql');
const { ObjectId } = require('mongodb');

const schema = buildSchema(`
    type Query {
      categories: [Category]
      products: [Product]
      searchProducts(text:String!):[Product]
      category(_id: String!): Category
    }
    type Product {
      _id: String!
      CrossReference: String!
      ItemDescription: String
      Price: Int
      category: Category
    }
    type Category {
      _id: String!
      ProductLine: String!
      ProductSeries: String!
      products: [Product]
    }
  `);

const findProductCategory = (categories, product) =>
  categories.find(item => item._id.toString() === product.CategoryId.toString());

const getProductsForCategory = async (db, categoryId) => {
  const products = await db
    .collection('products')
    .find({ CategoryId: categoryId })
    .toArray();

  return products;
};

const resolveProductsWithCategory = async (db, products) => {
  const categories = await db
    .collection('categories')
    .find({ _id: { $in: products.map(product => product.CategoryId) } })
    .toArray();

  return products.map(product => ({
    ...product,
    category: findProductCategory(categories, product),
  }));
};

const rootValue = {
  products: (args, { db }) =>
    db
      .collection('products')
      .find()
      .toArray()
      .then(resolveProductsWithCategory(db)),
  categories: (args, { db }) =>
    db
      .collection('categories')
      .aggregate([
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'CategoryId',
            as: 'products',
          },
        },
      ])
      .toArray(),
  // categories: (args, { db }) =>
  //   db
  //     .collection('categories')
  //     .find()
  //     .sort({ ProductLine: 1, ProductSeries: 1 })
  //     .toArray(),
  searchProducts: (args, { db }) =>
    db
      .collection('products')
      .find({ $text: { $search: args.text } })
      .toArray(),
  category: (args, { db }) =>
    db
      .collection('categories')
      .findOne({ _id: ObjectId(args._id) })
      .then(category => ({
        ...category,
        products: db
          .collection('products')
          .find({ CategoryId: ObjectId(args._id) })
          .toArray(),
      })),
};

module.exports = {
  schema,
  rootValue,
};
