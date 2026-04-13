import { DataTypes, Model, Sequelize } from 'sequelize'

export class User extends Model {
  declare id: number
  declare email: string
  declare firstName: string
  declare lastName: string
  declare status: 'active' | 'inactive' | 'suspended'
  declare age: number | null
  declare country: string | null
  declare createdAt: Date
  declare updatedAt: Date
}

export class Product extends Model {
  declare id: number
  declare name: string
  declare description: string | null
  declare price: number
  declare categoryId: number | null
  declare stockQuantity: number
  declare isActive: boolean
  declare createdAt: Date
  declare updatedAt: Date
}

export class Category extends Model {
  declare id: number
  declare name: string
  declare parentId: number | null
  declare description: string | null
}

export class Order extends Model {
  declare id: number
  declare userId: number
  declare status:
    | 'pending'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
  declare totalAmount: number
  declare shippingAddress: string | null
  declare createdAt: Date
  declare updatedAt: Date
}

export class OrderItem extends Model {
  declare id: number
  declare orderId: number
  declare productId: number
  declare quantity: number
  declare price: number
}

export class Review extends Model {
  declare id: number
  declare userId: number
  declare productId: number
  declare rating: number
  declare comment: string | null
  declare createdAt: Date
}

export function initSequelizeModels(sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'first_name',
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'last_name',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active',
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'users',
      timestamps: true,
      underscored: true,
    },
  )

  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'category_id',
      },
      stockQuantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'stock_quantity',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
      underscored: true,
    },
  )

  Category.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'parent_id',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'categories',
      timestamps: false,
    },
  )

  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
        ),
        defaultValue: 'pending',
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'total_amount',
      },
      shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'shipping_address',
      },
    },
    {
      sequelize,
      tableName: 'orders',
      timestamps: true,
      underscored: true,
    },
  )

  OrderItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'order_id',
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'product_id',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'order_items',
      timestamps: false,
    },
  )

  Review.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'product_id',
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
      },
    },
    {
      sequelize,
      tableName: 'reviews',
      timestamps: false,
    },
  )

  // Define associations
  User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' })
  User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' })

  Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' })
  Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' })
  Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' })

  Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' })

  Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
  Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'orderItems' })

  OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })
  OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

  Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
  Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })
}
