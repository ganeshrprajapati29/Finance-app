import express from 'express'
const router = express.Router()
import Collection from '../models/Collection.js'
import CallLog from '../models/CallLog.js'
import VisitLog from '../models/VisitLog.js'
import PromiseToPay from '../models/PromiseToPay.js'
import Loan from '../models/Loan.js'
import User from '../models/User.js'
import Employee from '../models/Employee.js'
import SmsLog from '../models/SmsLog.js'
import { sendSMS } from '../services/sms.js'
import { sendEmail } from '../services/email.js'

const toUpper = (value, fallback) => String(value || fallback || '').toUpperCase()

async function getLoanAndCollection(loanId, collectionId) {
  let collection = null
  if (collectionId) {
    collection = await Collection.findById(collectionId)
  }
  if (!collection && loanId) {
    collection = await Collection.findOne({ loanId, status: { $in: ['ACTIVE', 'LEGAL'] } })
  }

  const effectiveLoanId = loanId || collection?.loanId
  const loan = effectiveLoanId ? await Loan.findById(effectiveLoanId).populate('userId') : null
  return { loan, collection }
}

// Get overdue users list with bucket categorization
router.get('/overdue-users', async (req, res) => {
  try {
    const { bucket, agentId, status } = req.query

    // Get all disbursed loans
    const loans = await Loan.find({ status: 'DISBURSED' })
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
        else if (daysOverdue <= 90) bucketCategory = '60-90'
        else bucketCategory = '90+'

        // Check if already assigned to collection
        const existingCollection = await Collection.findOne({
          loanId: loan._id,
          status: { $in: ['ACTIVE', 'LEGAL'] }
        }).populate('assignedAgent')

        const userData = {
          loanId: loan._id,
          loanAccountNumber: loan.loanAccountNumber,
          collectionId: existingCollection?._id || null,
          userId: loan.userId,
          userName: loan.application?.personal?.name || loan.userId?.name || 'N/A',
          userEmail: loan.application?.personal?.email || loan.userId?.email || '',
          userPhone: loan.application?.personal?.mobile || loan.userId?.mobile || 'N/A',
          overdueAmount: overdueInstallments.reduce((sum, inst) => sum + Number(inst.total || 0), 0),
          daysOverdue,
          bucket: bucketCategory,
          overdueInstallments: overdueInstallments.length,
          oldestDueDate: oldestOverdue.dueDate,
          assignedAgent: existingCollection?.assignedAgent || null,
          collectionStatus: existingCollection?.status || 'UNASSIGNED',
          lastContactDate: existingCollection?.lastContactDate || null,
          nextFollowUpDate: existingCollection?.nextFollowUpDate || null,
          priority: existingCollection?.priority || (daysOverdue > 60 ? 'CRITICAL' : daysOverdue > 30 ? 'HIGH' : daysOverdue > 15 ? 'MEDIUM' : 'LOW'),
          notes: existingCollection?.notes || ''
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
          bucket90_plus: filteredUsers.filter(u => u.bucket === '90+').length,
          assigned: filteredUsers.filter(u => u.assignedAgent).length,
          unassigned: filteredUsers.filter(u => !u.assignedAgent).length,
          totalOverdueAmount: filteredUsers.reduce((sum, user) => sum + Number(user.overdueAmount || 0), 0)
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
    const loan = await Loan.findById(loanId).populate('userId')
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
    else if (daysOverdue <= 90) bucketCategory = '60-90'
    else bucketCategory = '90+'

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

// Create promise to pay from overdue users workflow
router.post('/ptp', async (req, res) => {
  try {
    const { loanId, collectionId, agentId, amount, promiseDate, notes } = req.body

    if (!loanId || !amount || !promiseDate) {
      return res.status(400).json({ success: false, message: 'Loan, amount and promise date are required' })
    }

    const loan = await Loan.findById(loanId).populate('userId')
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' })
    }

    let collection = null
    if (collectionId) {
      collection = await Collection.findById(collectionId)
    }
    if (!collection) {
      collection = await Collection.findOne({ loanId, status: { $in: ['ACTIVE', 'LEGAL'] } })
    }

    const effectiveAgentId = agentId || collection?.assignedAgent
    if (!effectiveAgentId) {
      return res.status(400).json({ success: false, message: 'Assign an agent before creating PTP' })
    }

    const ptp = await PromiseToPay.create({
      collectionId: collection?._id,
      loanId,
      userId: loan.userId,
      agentId: effectiveAgentId,
      promisedAmount: Number(amount),
      promisedDate: new Date(promiseDate),
      contactMethod: 'CALL',
      contactPerson: loan.userId?.name || loan.application?.personal?.name || 'Customer',
      relationship: 'SELF',
      reason: notes || 'Promise to pay created from overdue users page',
      followUpDate: new Date(promiseDate),
      notes
    })

    if (collection) {
      collection.lastContactDate = new Date()
      collection.nextFollowUpDate = new Date(promiseDate)
      await collection.save()
    }

    res.json({
      success: true,
      message: 'Promise to Pay created successfully',
      data: ptp
    })
  } catch (error) {
    console.error('Error creating PTP:', error)
    res.status(500).json({ success: false, message: 'Failed to create Promise to Pay' })
  }
})

// Get call logs
router.get('/call-logs', async (req, res) => {
  try {
    const { loanId, agentId, callStatus, callType, dateFrom, dateTo, page = 1, limit = 20 } = req.query

    const query = {}
    if (loanId) query.loanId = loanId
    if (agentId) query.agentId = agentId
    if (callStatus) query.callStatus = callStatus
    if (callType) query.callType = callType
    if (dateFrom || dateTo) {
      query.createdAt = {}
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
      if (dateTo) query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`)
    }

    const callLogs = await CallLog.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name email mobile')
      .populate('agentId', 'name email phone')
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

    const { loan, collection } = await getLoanAndCollection(loanId, collectionId)
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' })
    }

    const effectiveCollectionId = collectionId || collection?._id
    const effectiveUserId = userId || loan.userId?._id || loan.userId

    const callLog = new CallLog({
      collectionId: effectiveCollectionId,
      loanId: loan._id,
      userId: effectiveUserId,
      agentId,
      callType: toUpper(callType, 'OUTBOUND'),
      callStatus: toUpper(callStatus, 'CONNECTED'),
      callDuration: Number(callDuration || 0),
      contactPerson: contactPerson || loan.userId?.name || loan.application?.personal?.name || 'Customer',
      relationship: toUpper(relationship, 'SELF'),
      conversationSummary,
      nextAction: toUpper(nextAction, 'NONE'),
      nextActionDate,
      promiseToPay,
      notes
    })

    await callLog.save()

    // Update collection last contact date
    if (effectiveCollectionId) {
      await Collection.findByIdAndUpdate(effectiveCollectionId, {
        lastContactDate: new Date(),
        nextFollowUpDate: nextActionDate
      })
    }

    // Create PTP record if promise made
    if (promiseToPay && promiseToPay.amount && promiseToPay.date) {
      const ptp = new PromiseToPay({
        collectionId: effectiveCollectionId,
        loanId: loan._id,
        userId: effectiveUserId,
        agentId,
        promisedAmount: promiseToPay.amount,
        promisedDate: promiseToPay.date,
        contactMethod: 'CALL',
        contactPerson: contactPerson || loan.userId?.name || 'Customer',
        relationship: toUpper(relationship, 'SELF'),
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
    const { loanId, agentId, visitType, status, dateFrom, dateTo, page = 1, limit = 20 } = req.query

    const query = {}
    if (loanId) query.loanId = loanId
    if (agentId) query.agentId = agentId
    if (visitType) query.visitType = visitType
    if (status) query.visitStatus = status
    if (dateFrom || dateTo) {
      query.createdAt = {}
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
      if (dateTo) query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`)
    }

    const visitLogs = await VisitLog.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name email mobile')
      .populate('agentId', 'name email phone')
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

    const { loan, collection } = await getLoanAndCollection(loanId, collectionId)
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' })
    }

    const effectiveCollectionId = collectionId || collection?._id
    const effectiveUserId = userId || loan.userId?._id || loan.userId
    const normalizedLocation = typeof location === 'string' ? { address: location } : location
    const normalizedPayment = typeof paymentReceived === 'number'
      ? { amount: paymentReceived, method: 'CASH' }
      : paymentReceived

    const visitLog = new VisitLog({
      collectionId: effectiveCollectionId,
      loanId: loan._id,
      userId: effectiveUserId,
      agentId,
      visitType: toUpper(visitType, 'FIELD_VISIT'),
      visitStatus: toUpper(visitStatus, 'COMPLETED'),
      contactPerson: contactPerson || loan.userId?.name || loan.application?.personal?.name || 'Customer',
      relationship: toUpper(relationship, 'SELF'),
      location: normalizedLocation,
      visitPurpose: toUpper(visitPurpose, 'COLLECTION'),
      conversationSummary,
      nextAction: toUpper(nextAction, 'NONE'),
      nextActionDate,
      documentsCollected,
      paymentReceived: normalizedPayment,
      promiseToPay,
      photos,
      notes
    })

    await visitLog.save()

    // Update collection last contact date
    if (effectiveCollectionId) {
      await Collection.findByIdAndUpdate(effectiveCollectionId, {
        lastContactDate: new Date(),
        nextFollowUpDate: nextActionDate
      })
    }

    // Create PTP record if promise made
    if (promiseToPay && promiseToPay.amount && promiseToPay.date) {
      const ptp = new PromiseToPay({
        collectionId: effectiveCollectionId,
        loanId: loan._id,
        userId: effectiveUserId,
        agentId,
        promisedAmount: promiseToPay.amount,
        promisedDate: promiseToPay.date,
        contactMethod: 'VISIT',
        contactPerson: contactPerson || loan.userId?.name || 'Customer',
        relationship: toUpper(relationship, 'SELF'),
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

    const dateQuery = {}
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }

    const agentQuery = agentId
      ? { _id: agentId }
      : {
          $or: [
            { roles: { $in: ['COLLECTION_AGENT', 'collection', 'employee'] } },
            { 'permissions.canManageCollections': true }
          ],
          isActive: true
        }

    const agents = await Employee.find(agentQuery).select('name email phone department agentProfile')
    const performance = []

    for (const agent of agents) {
      const collections = await Collection.find({ assignedAgent: agent._id, ...dateQuery })
      .populate('assignedAgent', 'name')
      .populate('loanId', 'loanAccountNumber')
      let totalOverdueAmount = 0
      for (const collection of collections) {
        const loan = await Loan.findById(collection.loanId?._id || collection.loanId).select('schedule')
        const overdue = loan?.schedule?.filter(inst => !inst.paid && new Date(inst.dueDate) < new Date()) || []
        totalOverdueAmount += overdue.reduce((sum, inst) => sum + Number(inst.total || 0), 0)
      }

      const [callLogs, visitLogs, ptpCreated, ptpKept, recoveredAgg] = await Promise.all([
        CallLog.countDocuments({ agentId: agent._id, ...dateQuery }),
        VisitLog.countDocuments({ agentId: agent._id, ...dateQuery }),
        PromiseToPay.countDocuments({ agentId: agent._id, ...dateQuery }),
        PromiseToPay.countDocuments({ agentId: agent._id, status: 'KEPT', ...dateQuery }),
        VisitLog.aggregate([
          { $match: { agentId: agent._id, ...dateQuery } },
          { $group: { _id: null, amount: { $sum: '$paymentReceived.amount' } } }
        ])
      ])

      performance.push({
        agent,
        totalAssigned: collections.length,
        activeCases: collections.filter(item => item.status === 'ACTIVE').length,
        resolvedCases: collections.filter(item => item.status === 'RESOLVED' || item.status === 'SETTLED').length,
        legalCases: collections.filter(item => item.status === 'LEGAL').length,
        totalOverdueAmount,
        recoveredAmount: recoveredAgg[0]?.amount || 0,
        targetCollection: agent.agentProfile?.targetCollection || 0,
        callLogs,
        visitLogs,
        ptpCreated,
        ptpKept
      })
    }

    res.json({
      success: true,
      data: performance
    })
  } catch (error) {
    console.error('Error fetching agent performance:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch agent performance' })
  }
})

// Trigger warning SMS
router.post('/warning-sms', async (req, res) => {
  try {
    const { collectionId, loanId, message, sendEmail: shouldSendEmail = true } = req.body

    let collection = null
    if (collectionId) {
      collection = await Collection.findById(collectionId)
        .populate('loanId')
        .populate('userId')
    }
    if (!collection && loanId) {
      collection = await Collection.findOne({ loanId, status: { $in: ['ACTIVE', 'LEGAL'] } })
        .populate('loanId')
        .populate('userId')
    }

    let loan = collection?.loanId
    if (!loan && loanId) {
      loan = await Loan.findById(loanId).populate('userId')
    }

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' })
    }

    const user = collection?.userId || loan.userId
    const overdueInstallments = loan.schedule?.filter(inst => !inst.paid && new Date(inst.dueDate) < new Date()) || []
    const oldestOverdue = overdueInstallments[0]
    const daysOverdue = collection?.daysOverdue || (oldestOverdue ? Math.floor((new Date() - new Date(oldestOverdue.dueDate)) / (1000 * 60 * 60 * 24)) : 0)

    const smsMessage = message || `Dear ${user.name}, your loan account ${loan.loanAccountNumber} has overdue payments. Please contact us immediately to avoid legal action.`

    try {
      await sendSMS(user.mobile || user.phone, smsMessage)
      await SmsLog.create({
        collectionId: collection?._id,
        loanId: loan._id,
        userId: user._id,
        phone: user.mobile || user.phone,
        message: smsMessage,
        type: 'WARNING',
        status: 'SENT'
      })
    } catch (smsError) {
      await SmsLog.create({
        collectionId: collection?._id,
        loanId: loan._id,
        userId: user._id,
        phone: user.mobile || user.phone,
        message: smsMessage,
        type: 'WARNING',
        status: 'FAILED',
        error: smsError.message
      })
      throw smsError
    }

    // Send Email
    if (shouldSendEmail) {
      const emailSubject = 'Warning: Overdue Loan Payment'
      const emailBody = `
        Dear ${user.name},

        This is a warning regarding your outstanding loan payments.

        Loan Account Number: ${loan.loanAccountNumber}
        Overdue Amount: Rs. ${overdueInstallments.reduce((sum, inst) => sum + Number(inst.total || 0), 0)} (approximate)
        Days Overdue: ${daysOverdue}

        Message: ${message}

        Please contact us immediately to resolve this matter and avoid further action.

        Regards,
        Khatu Pay Collections Team
      `

      await sendEmail(user.email, emailSubject, emailBody)
    }

    res.json({
      success: true,
      message: 'Warning SMS and Email sent successfully'
    })
  } catch (error) {
    console.error('Error sending warning SMS:', error)
    res.status(500).json({ success: false, message: 'Failed to send warning SMS' })
  }
})

router.post('/bulk-warning-sms', async (req, res) => {
  try {
    const { loanIds = [], collectionIds = [], message } = req.body
    const collectionQuery = [
      loanIds.length ? { loanId: { $in: loanIds } } : null,
      collectionIds.length ? { _id: { $in: collectionIds } } : null
    ].filter(Boolean)

    const collections = collectionQuery.length
      ? await Collection.find({ $or: collectionQuery, status: { $in: ['ACTIVE', 'LEGAL'] } }).populate('loanId').populate('userId')
      : []

    const collectionLoanIds = new Set(collections.map(collection => collection.loanId?._id?.toString()))
    const directLoanIds = loanIds.filter(id => !collectionLoanIds.has(String(id)))
    const directLoans = directLoanIds.length ? await Loan.find({ _id: { $in: directLoanIds } }).populate('userId') : []

    let sent = 0
    let failed = 0
    let total = 0
    for (const collection of collections) {
      total++
      const user = collection.userId
      const loan = collection.loanId
      const smsMessage = message || `Dear ${user.name}, your loan account ${loan.loanAccountNumber} is overdue by ${collection.daysOverdue} days. Please make payment immediately. Khatu Pay`
      try {
        await sendSMS(user.mobile || user.phone, smsMessage)
        await SmsLog.create({ collectionId: collection._id, loanId: loan._id, userId: user._id, phone: user.mobile || user.phone, message: smsMessage, type: 'WARNING', status: 'SENT' })
        sent++
      } catch (error) {
        await SmsLog.create({ collectionId: collection._id, loanId: loan._id, userId: user._id, phone: user.mobile || user.phone, message: smsMessage, type: 'WARNING', status: 'FAILED', error: error.message })
        failed++
      }
    }

    for (const loan of directLoans) {
      total++
      const user = loan.userId
      const overdueInstallments = loan.schedule?.filter(inst => !inst.paid && new Date(inst.dueDate) < new Date()) || []
      const oldestOverdue = overdueInstallments[0]
      const daysOverdue = oldestOverdue ? Math.floor((new Date() - new Date(oldestOverdue.dueDate)) / (1000 * 60 * 60 * 24)) : 0
      const smsMessage = message || `Dear ${user.name}, your loan account ${loan.loanAccountNumber} is overdue by ${daysOverdue} days. Please make payment immediately. Khatu Pay`
      try {
        await sendSMS(user.mobile || user.phone, smsMessage)
        await SmsLog.create({ loanId: loan._id, userId: user._id, phone: user.mobile || user.phone, message: smsMessage, type: 'WARNING', status: 'SENT' })
        sent++
      } catch (error) {
        await SmsLog.create({ loanId: loan._id, userId: user._id, phone: user.mobile || user.phone, message: smsMessage, type: 'WARNING', status: 'FAILED', error: error.message })
        failed++
      }
    }

    res.json({ success: true, message: 'Bulk warning SMS processed', data: { sent, failed, total } })
  } catch (error) {
    console.error('Error sending bulk warning SMS:', error)
    res.status(500).json({ success: false, message: 'Failed to send bulk warning SMS' })
  }
})

router.get('/sms-history', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const smsHistory = await SmsLog.find()
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name mobile email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await SmsLog.countDocuments()
    res.json({ success: true, data: { smsHistory, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } } })
  } catch (error) {
    console.error('Error fetching SMS history:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch SMS history' })
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
      Outstanding Amount: Rs. ${collection.daysOverdue * 100} (approximate)

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
    const { status, agentId, dateFrom, dateTo, page = 1, limit = 20 } = req.query

    const query = {}
    if (status) query.status = status
    if (agentId) query.agentId = agentId
    if (dateFrom || dateTo) {
      query.promisedDate = {}
      if (dateFrom) query.promisedDate.$gte = new Date(dateFrom)
      if (dateTo) query.promisedDate.$lte = new Date(`${dateTo}T23:59:59.999Z`)
    }

    const ptps = await PromiseToPay.find(query)
      .populate('loanId', 'loanAccountNumber')
      .populate('userId', 'name email mobile')
      .populate('agentId', 'name email phone')
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
    const { status, promisedDate, actualPaymentDate, actualPaymentAmount, notes } = req.body

    const updateData = { status }
    if (promisedDate) updateData.promisedDate = promisedDate
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

    const smsMessage = `SETTLEMENT APPROVED: Dear ${user.name}, your settlement offer of Rs. ${settlementAmount} for loan ${loan.loanAccountNumber} has been approved. Please contact us to complete the payment.`

    const emailSubject = 'Settlement Offer Approved'
    const emailBody = `
      Dear ${user.name},

      Your settlement offer has been approved.

      Loan Account: ${loan.loanAccountNumber}
      Approved Settlement Amount: Rs. ${settlementAmount}
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
