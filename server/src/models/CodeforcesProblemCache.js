import mongoose from 'mongoose'

const codeforcesProblemCacheSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['Codeforces'],
      default: 'Codeforces',
      required: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      default: null,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    contestId: {
      type: Number,
      required: true,
    },
    problemIndex: {
      type: String,
      required: true,
      trim: true,
    },
    syncedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
)

export const CodeforcesProblemCache = mongoose.model(
  'CodeforcesProblemCache',
  codeforcesProblemCacheSchema,
)
