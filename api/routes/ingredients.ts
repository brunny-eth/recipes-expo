import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// Update ingredient
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const { data, error } = await supabase
      .from('ingredients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add substitution to ingredient
router.post('/:id/substitutions', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body
    
    const { data, error } = await supabase
      .from('substitutions')
      .insert({
        ingredient_id: id,
        name,
        description
      })
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export const ingredientRouter = router
