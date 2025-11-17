import express from 'express'
const router = express.Router()
import Collection from '../models/Collection.js'
import CallLog from '../models/CallLog.js'
import VisitLog from '../models/VisitLog.js'
import PromiseToPay from '../models/PromiseToPay.js'
import Loan from '../models/Loan.js'
import User from '../models/User.js'
import Employee from '../models/Employee.js'
import { sendSMS } from '../services/sms.js'
import { sendEmail } from '../services/email.js'

// Get overdue users list with bucket categorization
router.get('/overdue-users', async (req, res) => {
  try {
    const { bucket, agentId, status } = req.query

    // Get all disbursed loans
    const loans = await Loan.find({ status: 'DISBURSED' })
      .populate('application')
      .populate('userId')

    const overdueUsers = []

    for (const loan of loans) {
      const overdueInstallments = loan.schedule?.filter(inst =>
        !inst.paid && new Date(inst.dueDate) < new Date()
      ) || []

      if (overdueInstallments.length > 0) {
        const oldestOverdue = overdueInstallments.reduce((oldest, current) =>
          new Date(current.dueDate) < new Date(oldest.dueDate) ? current : oldest
        )

        const daysOverdue = Math.floor((new Date() - new Date(oldestOverdue.dueDate)) / (1000 * 60 * 60 * 24))

        let bucketCategory = ''
        if (daysOverdue <= 7) bucketCategory = '1-7'
        else if (daysOverdue <= 15) bucketCategory = '8-15'
        else if (daysOverdue <= 30) bucketCategory = '16-30'
        else if (daysOverdue <= 60) bucketCategory = '31-60'
        else bucketCategory = '60-90'

        // Check if already assigned to collection
        const existingCollection = await Collection.findOne({
          loanId: loan._id,
          status: { $in: ['ACTIVE', 'LEGAL'] }
        }).populate('assignedAgent')

        const userData = {
          loanId: loan._id,
          loanAccountNumber: loan.loanAccountNumber,
          userId: loan.userId,
          userName: loan.application?.personal?.name || 'N/A',
          userPhone: loan.application?.personal?.phone || 'N/A',
          overdueAmount: overdueInstallments.reduce((sum, inst) => sum + inst.total, 0),
          daysOverdue,
          bucket: bucketCategory,
          overdueInstallments: overdueInstallments.length,
          assignedAgent: existingCollection?.assignedAgent || null,
          collectionStatus: existingCollection?.status || 'UNASSIGNED',
          lastContactDate: existingCollection?.lastContactDate || null
        }

        overdueUsers.push(userData)
      }
    }

    // Apply filters
    let filteredUsers = overdueUsers

    if (bucket) {
      filteredUsers = filteredUsers.filter(user => user.bucket === bucket)
    }

    if (agentId) {
      filteredUsers = filteredUsers.filter(user => user.assignedAgent?._id.toString() === agentId)
    }

    if (status) {
      if (status === 'UNASSIGNED') {
        filteredUsers = filteredUsers.filter(user => !user.assignedAgent)
      } else {
        filteredUsers = filteredUsers.filter(user => user.collectionStatus === status)
      }
    }

    // Sort by days overdue (most critical first)
    filteredUsers.sort((a, b) => b.daysOverdue - a.daysOverdue)

    res.json({
      success: true,
      data: {
        users: filteredUsers,
        summary: {
          total: filteredUsers.length,
          bucket1_7: filteredUsers.filter(u => u.bucket === '1-7').length,
          bucket8_15: filteredUsers.filter(u => u.bucket === '8-15').length,
          bucket16_30: filteredUsers.filter(u => u.bucket === '16-30').length,
          bucket31_60: filteredUsers.filter(u => u.bucket === '31-60').length,
          bucket60_90: filteredUsers.filter(u => u.bucket === '60-90').length,
          assigned: filteredUsers.filter(u => u.assignedAgent).length,
          unassigned: filteredUsers.filter(u => !u.assignedAgent).length
        }
      }
    })
  } catch (error) {
    console.error('Error fetching overdue users:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch overdue users' })
  }
})

// Assign user to agent
router.post('/assign-agent', async (req, res) => {
  try {
    const { loanId, agentId, notes } = req.body

    // Check if already assigned
    const existingCollection = await Collection.findOne({
      loanId,
      status: { $in: ['ACTIVE', 'LEGAL'] }
    })

    if (existingCollection) {
      return res.status(400).json({
        success: false,
        message: 'User already assigned to an agent'
      })
    }

    // Get loan details
    const loan = await Loan.findById(loanId).populate('application').populate('userId')
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' })
    }

    // Calculate days overdue
    const overdueInstallments = loan.schedule?.filter(inst =>
      !inst.paid && new Date(inst.dueDate) < new Date()
    ) || []

    if (overdueInstallments.length === 0) {
      return res.status(400).json({ success: false, message: 'No overdue installments found' })
    }

    const oldestOverdue = overdueInstallments.reduce((oldest, current) =>
      new Date(current.dueDate) < new Date(oldest.dueDate) ? current : oldest
    )

    const daysOverdue = Math.floor((new Date() - new Date(oldestOverdue.dueDate)) / (1000 * 60 * 60 * 24))

    let bucketCategory = ''
    if (daysOverdue <= 7) bucketCategory = '1-7'
    else if (daysOverdue <= 15) bucketCategory = '8-15'
    else if (daysOverdue <= 30) bucketCategory = '16-30'
    else if (daysOverdue <= 60) bucketCategory = '31-60'
    else bucketCategory = '60-90'

    // Create collection record
    const collection = new Collection({
      loanId,
      userId: loan.userId,
      assignedAgent: agentId,
      bucket: bucketCategory,
      daysOverdue,
      notes
    })

    await collection.save()

    res.json({
      success: true,
      message: 'User assigned to agent successfully',
      data: collection
    })
  } catch (error) {
    console.error('Error assigning agent:', error)
    res.status(500).json({ success: false, message: 'Failed to assign agent' })
  }
})

// Get call logs
router.get('/call-logs', async (req, res) => {
  try {
    const { loanId, agentId, page = 1, limit = 20 } = req.query

    const query = {}
    if (loanId) query.loanId = loanId
    if (agentId) query.agentId = agentId

    const callLogs = await CallLog.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name phone')
      .populate('agentId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await CallLog.countDocuments(query)

    res.json({
      success: true,
      data: {
        callLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching call logs:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch call logs' })
  }
})

// Add call log
router.post('/call-log', async (req, res) => {
  try {
    const {
      collectionId,
      loanId,
      userId,
      agentId,
      callType,
      callStatus,
      callDuration,
      contactPerson,
      relationship,
      conversationSummary,
      nextAction,
      nextActionDate,
      promiseToPay,
      notes
    } = req.body

    const callLog = new CallLog({
      collectionId,
      loanId,
      userId,
      agentId,
      callType,
      callStatus,
      callDuration,
      contactPerson,
      relationship,
      conversationSummary,
      nextAction,
      nextActionDate,
      promiseToPay,
      notes
    })

    await callLog.save()

    // Update collection last contact date
    if (collectionId && collectionId !== '') {
      await Collection.findByIdAndUpdate(collectionId, {
        lastContactDate: new Date(),
        nextFollowUpDate: nextActionDate
      })
    }

    // Create PTP record if promise made
    if (promiseToPay && promiseToPay.amount && promiseToPay.date) {
      const ptp = new PromiseToPay({
        collectionId,
        loanId,
        userId,
        agentId,
        promisedAmount: promiseToPay.amount,
        promisedDate: promiseToPay.date,
        contactMethod: 'CALL',
        contactPerson,
        relationship,
        reason: conversationSummary,
        followUpDate: nextActionDate
      })
      await ptp.save()
    }

    res.json({
      success: true,
      message: 'Call log added successfully',
      data: callLog
    })
  } catch (error) {
    console.error('Error adding call log:', error)
    res.status(500).json({ success: false, message: 'Failed to add call log' })
  }
})

// Get visit logs
router.get('/visit-logs', async (req, res) => {
  try {
    const { loanId, agentId, page = 1, limit = 20 } = req.query

    const query = {}
    if (loanId) query.loanId = loanId
    if (agentId) query.agentId = agentId

    const visitLogs = await VisitLog.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name phone')
      .populate('agentId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await VisitLog.countDocuments(query)

    res.json({
      success: true,
      data: {
        visitLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching visit logs:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch visit logs' })
  }
})

// Add visit log
router.post('/visit-log', async (req, res) => {
  try {
    const {
      collectionId,
      loanId,
      userId,
      agentId,
      visitType,
      visitStatus,
      contactPerson,
      relationship,
      location,
      visitPurpose,
      conversationSummary,
      nextAction,
      nextActionDate,
      documentsCollected,
      paymentReceived,
      promiseToPay,
      photos,
      notes
    } = req.body

    const visitLog = new VisitLog({
      collectionId,
      loanId,
      userId,
      agentId,
      visitType,
      visitStatus,
      contactPerson,
      relationship,
      location,
      visitPurpose,
      conversationSummary,
      nextAction,
      nextActionDate,
      documentsCollected,
      paymentReceived,
      promiseToPay,
      photos,
      notes
    })

    await visitLog.save()

    // Update collection last contact date
    if (collectionId && collectionId !== '') {
      await Collection.findByIdAndUpdate(collectionId, {
        lastContactDate: new Date(),
        nextFollowUpDate: nextActionDate
      })
    }

    // Create PTP record if promise made
    if (promiseToPay && promiseToPay.amount && promiseToPay.date) {
      const ptp = new PromiseToPay({
        collectionId,
        loanId,
        userId,
        agentId,
        promisedAmount: promiseToPay.amount,
        promisedDate: promiseToPay.date,
        contactMethod: 'VISIT',
        contactPerson,
        relationship,
        reason: conversationSummary,
        followUpDate: nextActionDate
      })
      await ptp.save()
    }

    res.json({
      success: true,
      message: 'Visit log added successfully',
      data: visitLog
    })
  } catch (error) {
    console.error('Error adding visit log:', error)
    res.status(500).json({ success: false, message: 'Failed to add visit log' })
  }
})

// Get agent performance report
router.get('/agent-performance', async (req, res) => {
  try {
    const { agentId, startDate, endDate } = req.query

    const query = {}
    if (agentId) query.assignedAgent = agentId
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }

    const collections = await Collection.find(query)
      .populate('assignedAgent', 'name')
      .populate('loanId', 'loanAccountNumber')

    const performance = {}

    for (const collection of collections) {
      const agentId = collection.assignedAgent._id.toString()
      if (!performance[agentId]) {
        performance[agentId] = {
          agent: collection.assignedAgent,
          totalAssigned: 0,
          activeCases: 0,
          resolvedCases: 0,
          legalCases: 0,
          totalOverdueAmount: 0,
          recoveredAmount: 0,
          callLogs: 0,
          visitLogs: 0,
          ptpCreated: 0,
          ptpKept: 0
        }
      }

      performance[agentId].totalAssigned++
      performance[agentId].totalOverdueAmount += collection.daysOverdue * 100 // Rough estimate

      if (collection.status === 'ACTIVE') performance[agentId].activeCases++
      if (collection.status === 'RESOLVED') performance[agentId].resolvedCases++
      if (collection.status === 'LEGAL') performance[agentId].legalCases++

      // Get call logs count
      const callLogsCount = await CallLog.countDocuments({
        collectionId: collection._id,
        agentId: collection.assignedAgent._id
      })
      performance[agentId].callLogs += callLogsCount

      // Get visit logs count
      const visitLogsCount = await VisitLog.countDocuments({
        collectionId: collection._id,
        agentId: collection.assignedAgent._id
      })
      performance[agentId].visitLogs += visitLogsCount

      // Get PTP stats
      const ptpStats = await PromiseToPay.aggregate([
        { $match: { collectionId: collection._id, agentId: collection.assignedAgent._id } },
        {
          $group: {
            _id: null,
            created: { $sum: 1 },
            kept: { $sum: { $cond: [{ $eq: ['$status', 'KEPT'] }, 1, 0] } }
          }
        }
      ])

      if (ptpStats.length > 0) {
        performance[agentId].ptpCreated += ptpStats[0].created
        performance[agentId].ptpKept += ptpStats[0].kept
      }
    }

    res.json({
      success: true,
      data: Object.values(performance)
    })
  } catch (error) {
    console.error('Error fetching agent performance:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch agent performance' })
  }
})

// Trigger warning SMS
router.post('/warning-sms', async (req, res) => {
  try {
    const { collectionId, message } = req.body

    const collection = await Collection.findById(collectionId)
      .populate('loanId')
      .populate('userId')

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' })
    }

    const user = collection.userId
    const loan = collection.loanId

    const smsMessage = message || `Dear ${user.name}, your loan account ${loan.loanAccountNumber} has overdue payments. Please contact us immediately to avoid legal action.`

    // Send SMS
    await sendSMS(user.phone, smsMessage)

    // Send Email
    const emailSubject = 'Warning: Overdue Loan Payment'
    const emailBody = `
      Dear ${user.name},

      This is a warning regarding your outstanding loan payments.

      Loan Account Number: ${loan.loanAccountNumber}
      Overdue Amount: ₹${collection.daysOverdue * 100} (approximate)
      Days Overdue: ${collection.daysOverdue}

      Message: ${message}

      Please contact us immediately to resolve this matter and avoid further action.

      Regards,
      Khatu Pay Collections Team
    `

    await sendEmail(user.email, emailSubject, emailBody)

    res.json({
      success: true,
      message: 'Warning SMS and Email sent successfully'
    })
  } catch (error) {
    console.error('Error sending warning SMS:', error)
    res.status(500).json({ success: false, message: 'Failed to send warning SMS' })
  }
})

// Trigger legal notice
router.post('/legal-notice', async (req, res) => {
  try {
    const { collectionId, noticeType } = req.body

    const collection = await Collection.findById(collectionId)
      .populate('loanId')
      .populate('userId')

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' })
    }

    // Update collection status to legal
    await Collection.findByIdAndUpdate(collectionId, {
      status: 'LEGAL',
      updatedAt: new Date()
    })

    // Send legal notice via SMS and Email
    const user = collection.userId
    const loan = collection.loanId

    const smsMessage = `LEGAL NOTICE: Dear ${user.name}, legal proceedings have been initiated against loan account ${loan.loanAccountNumber} due to non-payment. Contact us immediately.`

    const emailSubject = 'Legal Notice - Outstanding Loan Payment'
    const emailBody = `
      Dear ${user.name},

      This is a legal notice regarding your outstanding loan payments.

      Loan Account: ${loan.loanAccountNumber}
      Outstanding Amount: ₹${collection.daysOverdue * 100} (approximate)

      You are hereby notified that legal proceedings will be initiated if payment is not made within 7 days.

      Please contact us immediately to resolve this matter.

      Regards,
      Khatu Pay Legal Team
    `

    await Promise.all([
      sendSMS(user.phone, smsMessage),
      sendEmail(user.email, emailSubject, emailBody)
    ])

    res.json({
      success: true,
      message: 'Legal notice sent successfully'
    })
  } catch (error) {
    console.error('Error sending legal notice:', error)
    res.status(500).json({ success: false, message: 'Failed to send legal notice' })
  }
})

// Get PTP tracking
router.get('/ptp-tracking', async (req, res) => {
  try {
    const { status, agentId, page = 1, limit = 20 } = req.query

    const query = {}
    if (status) query.status = status
    if (agentId) query.agentId = agentId

    const ptps = await PromiseToPay.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name phone')
      .populate('agentId', 'name')
      .sort({ promisedDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await PromiseToPay.countDocuments(query)

    res.json({
      success: true,
      data: {
        ptps,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching PTP tracking:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch PTP tracking' })
  }
})

// Update PTP status
router.put('/ptp/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { status, actualPaymentDate, actualPaymentAmount, notes } = req.body

    const updateData = { status }
    if (actualPaymentDate) updateData.actualPaymentDate = actualPaymentDate
    if (actualPaymentAmount) updateData.actualPaymentAmount = actualPaymentAmount
    if (notes) updateData.notes = notes

    const ptp = await PromiseToPay.findByIdAndUpdate(id, updateData, { new: true })

    if (!ptp) {
      return res.status(404).json({ success: false, message: 'PTP not found' })
    }

    res.json({
      success: true,
      message: 'PTP updated successfully',
      data: ptp
    })
  } catch (error) {
    console.error('Error updating PTP:', error)
    res.status(500).json({ success: false, message: 'Failed to update PTP' })
  }
})

// Approve settlement offer
router.post('/settlement-approve', async (req, res) => {
  try {
    const { collectionId, settlementAmount, terms } = req.body

    const collection = await Collection.findById(collectionId)
      .populate('loanId')
      .populate('userId')

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' })
    }

    // Update collection status to settled
    await Collection.findByIdAndUpdate(collectionId, {
      status: 'SETTLED',
      updatedAt: new Date()
    })

    // Send settlement approval notification
    const user = collection.userId
    const loan = collection.loanId

    const smsMessage = `SETTLEMENT APPROVED: Dear ${user.name}, your settlement offer of ₹${settlementAmount} for loan ${loan.loanAccountNumber} has been approved. Please contact us to complete the payment.`

    const emailSubject = 'Settlement Offer Approved'
    const emailBody = `
      Dear ${user.name},

      Your settlement offer has been approved.

      Loan Account: ${loan.loanAccountNumber}
      Approved Settlement Amount: ₹${settlementAmount}
      Terms: ${terms}

      Please contact us within 7 days to complete the settlement.

      Regards,
      Khatu Pay Collections Team
    `

    await Promise.all([
      sendSMS(user.phone, smsMessage),
      sendEmail(user.email, emailSubject, emailBody)
    ])

    res.json({
      success: true,
      message: 'Settlement offer approved successfully'
    })
  } catch (error) {
    console.error('Error approving settlement:', error)
    res.status(500).json({ success: false, message: 'Failed to approve settlement' })
  }
})

export default router
