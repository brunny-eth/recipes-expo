import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// Update ingredient
router.patch('/:id', async (req: Request, res: Response) => {
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
    console.error('Error in PATCH /ingredients/:id :', error); 
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Add substitution to ingredient
router.post('/:id/substitutions', async (req: Request, res: Response) => {
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
    console.error('Error in POST /ingredients/:id/substitutions :', error); 
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

export const ingredientRouter = router
