/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'

const router = Router()

/**
 * User Login
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    error: 'Use Supabase Auth on the client (signUp/signInWithPassword).',
  })
})

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    error: 'Use Supabase Auth on the client (signUp/signInWithPassword).',
  })
})

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    error: 'Use Supabase Auth on the client (signOut).',
  })
})

export default router
