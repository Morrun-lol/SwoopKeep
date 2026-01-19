import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

/**
 * Generate Q-Version Avatar
 * POST /api/avatar/generate
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const { imageBase64, style, userId } = req.body 
  
  if (!imageBase64 || !style) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }
  
  // Mock AI Generation: Return a placeholder URL based on style
  // Using DiceBear for demo purposes
  const avatarId = `avatar_${Date.now()}`
  // Map style to DiceBear collection
  let collection = 'avataaars'
  if (style === '3d') collection = 'bottts'
  if (style === 'sketch') collection = 'micah'
  
  const qVersionUrl = `https://api.dicebear.com/7.x/${collection}/svg?seed=${avatarId}`
  
  try {
    if (userId) {
       const stmt = db.prepare(`
        INSERT INTO avatars (avatar_id, user_id, original_url, q_version_url, style_type)
        VALUES (?, ?, ?, ?, ?)
      `)
      // Store dummy original URL (in real app, upload base64 to storage)
      stmt.run(avatarId, userId, 'mock_original_url_stored', qVersionUrl, style)
    }
   
    res.json({
      avatarUrl: qVersionUrl,
      styleId: style
    })
  } catch (error) {
    console.error('Avatar generation error:', error)
    res.status(500).json({ error: 'Generation failed' })
  }
})

export default router
