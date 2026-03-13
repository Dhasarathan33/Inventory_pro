import mongoose, { Document, Schema } from 'mongoose'

// ✅ Add this interface
export interface IProduct extends Document {
  name: string
  category: string
  quantity: number
  price: number
  description?: string
  lowStockThreshold?: number
  sku: string
  imageUrl?: string
  expiryDate?: Date | null
  createdBy?: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
  cost: number
}

const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    default: '',
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  cost: { // 👈 ADD THIS FIELD
        type: Number,
        required: true,
        min: 0,
        default: 0, // Set a default value
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
}, { timestamps: true })

// ✅ Export the model (reusing existing one if hot reloaded)
const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
export default Product
