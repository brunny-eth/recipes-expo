import 'dotenv/config'
import { embedText } from '../embedText'

async function run() {
  const vector = await embedText("blueberry pancakes")
  console.log("Vector length:", vector.length)
  console.log("First 5 values:", vector.slice(0, 5))
}

run().catch(console.error)