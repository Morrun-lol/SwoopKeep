import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

/**
 * WeChat Login
 * POST /api/auth/wechat-login
 */
router.post('/wechat-login', async (req: Request, res: Response): Promise<void> => {
  const { code, userInfo } = req.body
  
  // Mock WeChat login: use code as openid part for now
  // In real app, exchange code for openid from WeChat API
  const openid = `mock_openid_${code || 'unknown'}`
  const token = `mock_token_${Date.now()}`
  
  try {
    const stmt = db.prepare(`
      INSERT INTO users (openid, nickname, avatar_url, gender)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(openid) DO UPDATE SET
      nickname = excluded.nickname,
      avatar_url = excluded.avatar_url,
      last_login = CURRENT_TIMESTAMP
    `)
    
    stmt.run(
      openid, 
      userInfo?.nickName || 'Guest', 
      userInfo?.avatarUrl || '', 
      userInfo?.gender || 0
    )
    
    res.json({
      token,
      userId: openid,
      expiresIn: 7200
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
