import mongoose, { Schema, models } from 'mongoose'

const SaleSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  profit: { type: Number, default: 0 },
  customerName: { type: String },
  createdAt: { type: Date, default: Date.now }
})

const Sale = models.Sale || mongoose.model('Sale', SaleSchema)
export default Sale
