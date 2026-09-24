import express from 'express'
const router = express.Router()
import Employee from '../models/Employee.js'
import bcrypt from 'bcryptjs'
import { sendMail } from '../services/mailer.js'
import { requireAuth } from '../middlewares/auth.js'
import { requireRole } from '../middlewares/role.js'

// Only admins can manage agents
router.use(requireAuth, requireRole(['admin']))

// Get all agents (collection agents)
router.get('/', async (req, res) => {
  try {
    const { status, department } = req.query
    const query = {
      $or: [
        { roles: { $in: ['COLLECTION_AGENT', 'collection', 'employee'] } },
        { 'permissions.canManageCollections': true }
      ]
    }
    if (status) {
      query.status = status
      query.isActive = status === 'active'
    }
    if (department) query.department = department

    const agents = await Employee.find(query).select('-passwordHash').sort({ createdAt: -1 })

    res.json({
      success: true,
      data: {
        agents,
        total: agents.length
      }
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents'
    })
  }
})

// Create new agent
router.post('/', async (req, res) => {
  try {
    const { name, email, mobile, phone, password, role, roles, department, isActive, agentProfile = {} } = req.body

    // Check if agent already exists
    const existingAgent = await Employee.findOne({ email: email.toLowerCase() })
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this email already exists'
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create agent
    const agent = new Employee({
      name,
      email: email.toLowerCase(),
      phone: mobile || phone,
      passwordHash,
      roles: roles?.length ? roles : [role || 'COLLECTION_AGENT'],
      department: department || 'COLLECTIONS',
      status: isActive === false ? 'inactive' : 'active',
      isActive: isActive !== undefined ? isActive : true,
      agentProfile: {
        employeeId: agentProfile.employeeId || `AG-${Date.now()}`,
        designation: agentProfile.designation || 'Collection Agent',
        joiningDate: agentProfile.joiningDate ? new Date(agentProfile.joiningDate) : new Date(),
        address: agentProfile.address,
        aadhaarNumber: agentProfile.aadhaarNumber,
        panNumber: agentProfile.panNumber,
        salary: Number(agentProfile.salary || 0),
        emergencyContact: agentProfile.emergencyContact,
        emergencyContactName: agentProfile.emergencyContactName,
        targetCollection: Number(agentProfile.targetCollection || 0),
        area: agentProfile.area,
        zone: agentProfile.zone
      },
      permissions: {
        canManageUsers: false,
        canManageLoans: false,
        canManagePayments: false,
        canManageSupport: true,
        canSendNotifications: false,
        canViewAudit: false,
        canManageSettings: false,
        canManageCollections: true,
        canViewReports: true
      }
    })

    await agent.save()

    // Send welcome email
    try {
      await sendMail(
        email,
        'Welcome to Khatu Pay Collections Team',
        `<p>Hi ${name},</p>
        <p>You have been added to the Khatu Pay Collections team.</p>
        <p>Your login credentials:</p>
        <p>Email: ${email}</p>
        <p>Password: ${password}</p>
        <p>Please change your password after first login.</p>
        <p>Regards,<br>Khatu Pay Team</p>`,
        `Welcome to Khatu Pay Collections Team. Email: ${email}, Password: ${password}`
      )
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
    }

    // Return agent without password
    const agentResponse = agent.toObject()
    delete agentResponse.passwordHash

    res.json({
      success: true,
      message: 'Agent created successfully',
      data: agentResponse
    })
  } catch (error) {
    console.error('Error creating agent:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create agent'
    })
  }
})

// Update agent
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, phone, role, roles, department, isActive, status, agentProfile } = req.body

    const updateData = {}
    if (name) updateData.name = name
    if (mobile || phone) updateData.phone = mobile || phone
    if (role) updateData.roles = [role]
    if (roles?.length) updateData.roles = roles
    if (department) updateData.department = department
    if (isActive !== undefined) {
      updateData.isActive = isActive
      updateData.status = isActive ? 'active' : 'inactive'
    }
    if (status) {
      updateData.status = status
      updateData.isActive = status === 'active'
    }
    if (agentProfile) {
      Object.entries(agentProfile).forEach(([key, value]) => {
        updateData[`agentProfile.${key}`] = ['salary', 'targetCollection'].includes(key) ? Number(value || 0) : value
      })
    }

    const agent = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-passwordHash')

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      })
    }

    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: agent
    })
  } catch (error) {
    console.error('Error updating agent:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update agent'
    })
  }
})

// Delete agent (soft delete by setting inactive)
router.delete('/:id', async (req, res) => {
  try {
    const agent = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: 'inactive' },
      { new: true }
    ).select('-passwordHash')

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      })
    }

    res.json({
      success: true,
      message: 'Agent deactivated successfully',
      data: agent
    })
  } catch (error) {
    console.error('Error deactivating agent:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate agent'
    })
  }
})

// Reset agent password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      })
    }

    const agent = await Employee.findById(req.params.id)
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12)
    agent.passwordHash = passwordHash
    await agent.save()

    // Send password reset email
    try {
      await sendMail(
        agent.email,
        'Password Reset - Khatu Pay Collections',
        `<p>Hi ${agent.name},</p>
        <p>Your password has been reset.</p>
        <p>New password: ${password}</p>
        <p>Please change your password after login.</p>
        <p>Regards,<br>Khatu Pay Team</p>`,
        `Password reset. New password: ${password}`
      )
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    })
  }
})

export default router
