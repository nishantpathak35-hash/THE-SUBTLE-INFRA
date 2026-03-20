console.log("Starting server process...");
import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to: string, subject: string, body: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: body,
    });
    console.log(`Email sent to ${to}`);
  } catch (e) {
    console.error("Email failed:", e);
  }
}

async function startServer() {
  // ... existing setup ...
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected" });
    } catch (e: any) {
      res.status(500).json({ status: "error", database: e.message });
    }
  });

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies?.token;
    if (!token) {
      console.warn(`[AUTH] Unauthorized access attempt to ${req.originalUrl}`);
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (e: any) {
      console.error(`[AUTH] Token verification failed for ${req.originalUrl}:`, e.message);
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- Auth Routes ---
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, role },
      });
      res.json({ message: "User created" });
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(`Login attempt for: ${email}`);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`User not found: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`Invalid password for: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      console.log(`Login successful for: ${email}`);
      const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET);
      res.cookie("token", token, { 
        httpOnly: true, 
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", 
        secure: process.env.NODE_ENV === "production" 
      });
      res.json({ user: { id: user.id, role: user.role, name: user.name } });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  // --- Payment Tracking (PTS) Routes ---
  app.get("/api/pts", authenticate, async (req, res) => {
    try {
      console.log("[PTS] Request received at /api/pts");
      
      let pos;
      try {
        pos = await prisma.purchaseOrder.findMany({
          include: {
            vendor: true,
            boq: { 
              include: { 
                client: true 
              } 
            },
            invoices: {
              include: {
                payments: true
              }
            },
            outflows: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (prismaError: any) {
        console.error("[PTS] Prisma Fetch Error:", prismaError);
        return res.status(500).json({ error: "Database error while fetching POs", details: prismaError.message });
      }

      console.log(`[PTS] Successfully fetched ${pos.length} POs from database`);

      const ptsData = pos.map((po, idx) => {
        try {
          const invoices = po.invoices || [];
          const outflows = po.outflows || [];
          
          const invoicePaid = invoices.reduce((sum, inv) => {
            const payments = inv.payments || [];
            return sum + payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          }, 0);

          const directPaid = outflows.reduce((sum, out) => sum + (Number(out.amount) || 0), 0);
          const totalPaid = invoicePaid + directPaid;
          
          const certifiedValue = invoices.reduce((sum, inv) => 
            sum + (Number(inv.certifiedAmount) || Number(inv.amount) || 0), 0);
          
          const tds = invoices.reduce((sum, inv) => sum + (Number(inv.tdsAmount) || 0), 0);
          const totalAmount = Number(po.totalAmount) || 0;

          return {
            id: po.id,
            poNumber: po.poNumber || `DRAFT-${idx}`,
            project: po.boq?.name || "Standalone",
            projectId: po.boq?.id || "",
            client: po.boq?.client?.name || "N/A",
            clientId: po.boq?.client?.id || "",
            vendor: po.vendor?.name || "N/A",
            vendorId: po.vendor?.id || "",
            poValue: totalAmount,
            certifiedValue: certifiedValue || totalPaid,
            amountPaid: totalPaid,
            paidPercent: totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0,
            balancePayment: Math.max(0, totalAmount - totalPaid),
            tds,
            status: po.status
          };
        } catch (innerError: any) {
          console.error(`[PTS] Error processing PO record #${idx} (ID: ${po.id}):`, innerError.message);
          return null;
        }
      }).filter(Boolean);

      console.log(`[PTS] Prepared ${ptsData.length} records for response`);
      res.json(ptsData);
    } catch (e: any) {
      console.error("[PTS] CRITICAL BACKEND ERROR:", e);
      res.status(500).json({ 
        error: "Failed to fetch PTS data", 
        details: e.message,
        prismaCode: e.code,
        stack: e.stack
      });
    }
  });

  // --- AI Insights ---
  app.post("/api/ai/insights", authenticate, async (req, res) => {
    const { boqData } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Gemini API key not configured" });

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are an expert Quantity Surveyor and Financial Analyst for the interior fit-out industry.
      Analyze the following Bill of Quantities (BOQ) data and provide 5-7 high-impact, actionable insights.
      
      Focus on:
      1. Margin Analysis: Identify items where margins are below 15% or exceptionally high.
      2. Cost Efficiency: Suggest potential areas for cost saving or better vendor negotiation.
      3. Execution Risk: Based on progress vs. time/cost, identify items at risk of delay or overrun.
      4. Financial Health: Comment on the overall project profitability and cash flow status.
      5. Vendor Intelligence: If certain vendors are consistently high-priced, point it out.

      BOQ Data: ${JSON.stringify(boqData)}
      
      Format: Return ONLY a JSON array of strings, where each string is a concise, professional insight. Do not include any other text or formatting.`;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { 
          responseMimeType: "application/json"
        }
      });
      
      res.json(JSON.parse(result.text || "[]"));
    } catch (e: any) {
      console.error("AI Insight Error:", e);
      res.status(500).json({ error: "Failed to generate AI insights", details: e.message });
    }
  });

  // --- Settings Routes ---
  app.get("/api/settings", authenticate, async (req, res) => {
    try {
      let settings = await prisma.settings.findUnique({ where: { id: "default" } });
      if (!settings) {
        settings = await prisma.settings.create({
          data: { 
            id: "default", 
            companyName: "THE SUBTLE INFRA - Business Intelligence", 
            poSeries: "PO", 
            poNextNumber: 1,
            defaultGstRate: 18,
            defaultMargin: 20,
            currencySymbol: "₹",
            projectCategories: "Residential,Commercial,Industrial,Infrastructure"
          }
        });
      }
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticate, async (req, res) => {
    const { 
      companyName, address, logoUrl, gstNumber, panNumber, 
      poSeries, poNextNumber, poTerms,
      defaultGstRate, defaultMargin, currencySymbol, projectCategories
    } = req.body;
    try {
      const settings = await prisma.settings.update({
        where: { id: "default" },
        data: { 
          companyName, 
          address, 
          logoUrl, 
          gstNumber, 
          panNumber, 
          poSeries, 
          poNextNumber: parseInt(poNextNumber || "1"), 
          poTerms,
          defaultGstRate: parseFloat(defaultGstRate || "18"),
          defaultMargin: parseFloat(defaultMargin || "20"),
          currencySymbol: currencySymbol || "₹",
          projectCategories: projectCategories || "Residential,Commercial,Industrial,Infrastructure"
        }
      });
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // --- Dashboard Stats ---
  app.get("/api/dashboard/stats", authenticate, async (req, res) => {
    try {
      const [
        boqs,
        items,
        vendors,
        pos,
        pendingInvoices,
        totalInflow,
        totalOutflow,
        lineItems
      ] = await Promise.all([
        prisma.bOQ.findMany({ select: { totalValue: true, totalMargin: true, status: true } }),
        prisma.itemMaster.count(),
        prisma.vendor.count(),
        prisma.purchaseOrder.findMany({ select: { totalAmount: true } }),
        prisma.invoice.count({ where: { status: "Pending" } }),
        prisma.inflow.aggregate({ _sum: { amount: true } }),
        prisma.outflow.aggregate({ _sum: { amount: true } }),
        prisma.bOQLineItem.findMany({ select: { quantity: true, progress: { select: { quantity: true } } } })
      ]);

      const totalPipelineValue = boqs.reduce((acc, b) => acc + b.totalValue, 0);
      const avgMargin = boqs.length ? boqs.reduce((acc, b) => acc + b.totalMargin, 0) / boqs.length : 0;
      const pendingApprovals = boqs.filter(b => b.status === "Pending Approval").length;
      const approvedValue = boqs.filter(b => b.status === "Approved").reduce((acc, b) => acc + b.totalValue, 0);
      const totalPOValue = pos.reduce((acc, p) => acc + p.totalAmount, 0);

      // Calculate overall progress
      let totalPlanned = 0;
      let totalExecuted = 0;
      lineItems.forEach(li => {
        totalPlanned += li.quantity;
        totalExecuted += li.progress.reduce((sum, p) => sum + p.quantity, 0);
      });
      const overallProgress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

      res.json({
        totalPipelineValue,
        avgMargin,
        pendingApprovals,
        approvedValue,
        totalPOValue,
        itemCount: items,
        vendorCount: vendors,
        poCount: pos.length,
        pendingInvoices,
        totalInflow: totalInflow._sum.amount || 0,
        totalOutflow: totalOutflow._sum.amount || 0,
        overallProgress
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // --- User Management Routes ---
  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  });

  app.post("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, role },
      });
      res.json({ message: "User created", user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.put("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
    const { email, name, role, password } = req.body;
    try {
      const data: any = { email, name, role };
      if (password) {
        data.password = await bcrypt.hash(password, 10);
      }
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data
      });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (e) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
    if (req.user.id === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Failed to delete user" });
    }
  });

  // --- BOQ Routes ---
  app.get("/api/boqs", authenticate, async (req, res) => {
    try {
      const boqs = await prisma.bOQ.findMany({
        include: { 
          createdBy: { select: { name: true } },
          client: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(boqs);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch BOQs" });
    }
  });

  app.post("/api/boqs", authenticate, async (req: any, res) => {
    const { name, clientId, state, category } = req.body;
    try {
      const boq = await prisma.bOQ.create({
        data: { 
          name, 
          createdById: req.user.id,
          clientId: clientId || null,
          state: state || "Maharashtra",
          category: category || "Residential"
        },
        include: { createdBy: true, client: true }
      });
      res.json(boq);
    } catch (e) {
      res.status(400).json({ error: "Failed to create BOQ" });
    }
  });

  app.get("/api/boqs/:id", authenticate, async (req, res) => {
    try {
      const boq = await prisma.bOQ.findUnique({
        where: { id: req.params.id },
        include: {
          lineItems: { 
            include: { 
              item: { include: { stateRates: true } },
              vendor: true,
              progress: {
                include: { updatedBy: true },
                orderBy: { date: 'desc' }
              }
            }
          },
          createdBy: { select: { name: true } },
          approvals: { include: { user: { select: { name: true } } } },
          inflows: { orderBy: { date: 'desc' } },
          pos: { 
            include: { 
              vendor: true,
              payments: true,
              invoices: { include: { payments: true } }
            } 
          }
        }
      });

      if (!boq) return res.status(404).json({ error: "BOQ not found" });

      // Fetch outflows separately to avoid stale include error
      const outflows = await (prisma as any).outflow.findMany({
        where: { boqId: boq.id },
        include: { vendor: true, purchaseOrder: true },
        orderBy: { date: 'desc' }
      });

      res.json({ ...boq, outflows });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch BOQ details" });
    }
  });

  app.put("/api/boqs/:id/line-items", authenticate, async (req: any, res) => {
    const { items, startDate, endDate, category } = req.body; 
    const boqId = req.params.id;

    try {
      const boq = await prisma.bOQ.findUnique({ where: { id: boqId } });
      if (boq?.status !== "Draft" && boq?.status !== "Rejected" && req.user.role !== "Admin") {
        return res.status(400).json({ error: "BOQ is locked" });
      }

      await prisma.bOQLineItem.deleteMany({ where: { boqId } });

      let totalCost = 0;
      let totalValue = 0;
      let totalGst = 0;
      let subTotal = 0;

      const processedItems = [];
      for (const item of items) {
        // Use provided rate/vendor or auto-choose lowest rate
        let bcs = parseFloat(item.rate || "0");
        let vendorId = item.vendorId || null;

        if (!bcs && !vendorId) {
          const lowestRate = await prisma.vendorRate.findFirst({
            where: { itemId: item.itemId, status: "Active" },
            orderBy: { activeRate: 'asc' }
          });
          bcs = lowestRate ? (lowestRate.activeRate || lowestRate.submittedRate) : 0;
          vendorId = lowestRate ? lowestRate.vendorId : null;
        }

        const qty = parseFloat(item.quantity || "0");
        const clientPrice = parseFloat(item.clientPrice || "0");
        const gstRate = parseFloat(item.gstRate || "0");
        
        const lineSubTotal = bcs * qty;
        const lineGst = lineSubTotal * (gstRate / 100);
        const amount = lineSubTotal + lineGst;
        
        const margin = clientPrice > 0 ? ((clientPrice - bcs) / clientPrice) * 100 : 0;
        
        subTotal += lineSubTotal;
        totalGst += lineGst;
        totalCost += lineSubTotal;
        totalValue += clientPrice * qty;
        
        processedItems.push({
          boqId,
          itemId: item.itemId,
          description: item.description,
          category: item.category,
          unit: item.unit,
          quantity: qty,
          rate: bcs,
          gstRate: gstRate,
          gstAmount: lineGst,
          amount: amount,
          vendorId: vendorId,
          rateType: item.rateType || "SupplyPlusInstallation",
          bcs: bcs,
          clientPrice: clientPrice,
          margin: margin
        });
      }

      await prisma.bOQLineItem.createMany({ data: processedItems });

      const totalMargin = totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0;

      await prisma.bOQ.update({
        where: { id: boqId },
        data: { 
          subTotal,
          gstAmount: totalGst,
          totalCost, 
          totalValue, 
          totalMargin,
          category,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update line items" });
    }
  });

  app.post("/api/boqs/:id/submit", authenticate, async (req: any, res) => {
    try {
      const status = req.user.role === "Admin" ? "Approved" : "Pending Approval";
      await prisma.bOQ.update({
        where: { id: req.params.id },
        data: { status }
      });
      
      if (req.user.role === "Admin") {
        await prisma.approval.create({
          data: { 
            boqId: req.params.id, 
            userId: req.user.id, 
            status: "Approved", 
            comment: "Auto-approved by Admin" 
          }
        });
      }
      
      res.json({ success: true, status });
    } catch (e) {
      res.status(500).json({ error: "Failed to submit BOQ" });
    }
  });

  app.post("/api/boqs/:id/approve", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Estimator") return res.status(403).json({ error: "Forbidden" });
    const { status, comment } = req.body; // Approved or Rejected
    try {
      await prisma.$transaction([
        prisma.bOQ.update({ where: { id: req.params.id }, data: { status } }),
        prisma.approval.create({ data: { boqId: req.params.id, userId: req.user.id, status, comment } })
      ]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to process approval" });
    }
  });

  // --- Progress Update Routes ---
  app.post("/api/line-items/:id/progress", authenticate, async (req: any, res) => {
    const { quantity, remarks, date } = req.body;
    try {
      const update = await prisma.progressUpdate.create({
        data: {
          lineItemId: req.params.id,
          quantity: parseFloat(quantity),
          remarks,
          date: date ? new Date(date) : new Date(),
          updatedById: req.user.id
        },
        include: { updatedBy: true }
      });
      res.json(update);
    } catch (e) {
      res.status(400).json({ error: "Failed to log progress" });
    }
  });

  app.delete("/api/progress-updates/:id", authenticate, async (req: any, res) => {
    try {
      await prisma.progressUpdate.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Failed to delete progress update" });
    }
  });

  // --- Master Item Routes ---
  app.get("/api/items", authenticate, async (req, res) => {
    try {
      const items = await prisma.itemMaster.findMany({
        include: { 
          stateRates: true,
          vendorMappings: { include: { vendor: true } }
        },
        orderBy: { itemCode: 'asc' }
      });
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.post("/api/items", authenticate, async (req: any, res) => {
    if (req.user.role === "Viewer") return res.status(403).json({ error: "Forbidden" });
    const { 
      itemCode, name, category, subCategory, description, unit, 
      materialMake, sizeThickness, finishColor, applicationArea, 
      vendorType, hsnSac, typicalRateBand, remarks, status, stateRates 
    } = req.body;
    
    try {
      const item = await prisma.itemMaster.create({
        data: {
          itemCode, name, category, subCategory, description, unit,
          materialMake, sizeThickness, finishColor, applicationArea,
          vendorType, hsnSac, typicalRateBand, remarks, status: status || "Active",
          stateRates: {
            create: stateRates || []
          }
        },
        include: { stateRates: true }
      });
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: "Item Code must be unique" });
    }
  });

  app.put("/api/items/:id", authenticate, async (req: any, res) => {
    if (req.user.role === "Viewer") return res.status(403).json({ error: "Forbidden" });
    const { 
      itemCode, name, category, subCategory, description, unit, 
      materialMake, sizeThickness, finishColor, applicationArea, 
      vendorType, hsnSac, typicalRateBand, remarks, status, stateRates 
    } = req.body;
    
    try {
      const item = await prisma.itemMaster.update({
        where: { id: req.params.id },
        data: {
          itemCode, name, category, subCategory, description, unit,
          materialMake, sizeThickness, finishColor, applicationArea,
          vendorType, hsnSac, typicalRateBand, remarks, status,
          stateRates: {
            deleteMany: {},
            create: stateRates || []
          }
        },
        include: { stateRates: true }
      });
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: "Failed to update item" });
    }
  });

  app.post("/api/items/bulk-import", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Estimator") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { items, mode } = req.body; // mode: 'insert' or 'upsert'
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.itemMaster.findUnique({ where: { itemCode: item.itemCode } });
        if (existing) {
          if (mode === 'upsert') {
            await prisma.itemMaster.update({
              where: { id: existing.id },
              data: { ...item, updatedAt: new Date() }
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await prisma.itemMaster.create({ data: item });
          imported++;
        }
      } catch (e: any) {
        failed++;
        errors.push({ itemCode: item.itemCode, error: e.message });
      }
    }

    res.json({ summary: { total: items.length, imported, updated, skipped, failed }, errors });
  });

  // --- State Routes ---
  app.get("/api/states", authenticate, async (req, res) => {
    const states = await prisma.state.findMany({ orderBy: { name: 'asc' } });
    res.json(states);
  });

  app.post("/api/states", authenticate, async (req: any, res) => {
    try {
      console.log(`[STATE CREATE] Request by ${req.user?.email || 'unknown'} (Role: ${req.user?.role})`);
      console.log(`[STATE CREATE] Body:`, req.body);
      
      if (req.user.role !== "Admin" && req.user.role !== "Estimator") {
        console.log(`[STATE CREATE] Forbidden for role: ${req.user.role}`);
        return res.status(403).json({ error: `Forbidden: Your role (${req.user.role}) does not have permission to add states.` });
      }
      
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "State name is required and must be a string" });
      }
      
      const state = await prisma.state.create({ data: { name: name.trim() } });
      console.log(`[STATE CREATE] Success: ${state.name}`);
      res.json(state);
    } catch (e: any) {
      console.error(`[STATE CREATE] Fatal Error:`, e);
      if (e.code === 'P2002') {
        return res.status(400).json({ error: "State already exists" });
      }
      res.status(500).json({ error: "Internal Server Error", details: e.message });
    }
  });

  app.delete("/api/states/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
    try {
      await prisma.state.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Failed to delete state" });
    }
  });

  // --- Item Vendor Mapping Routes ---
  app.post("/api/item-vendor-mappings", authenticate, async (req: any, res) => {
    if (req.user.role === "Viewer") return res.status(403).json({ error: "Forbidden" });
    const { itemId, vendorId } = req.body;
    try {
      const mapping = await prisma.itemVendorMapping.create({
        data: { itemId, vendorId }
      });
      res.json(mapping);
    } catch (e) {
      res.status(400).json({ error: "Mapping already exists" });
    }
  });

  app.delete("/api/item-vendor-mappings", authenticate, async (req: any, res) => {
    if (req.user.role === "Viewer") return res.status(403).json({ error: "Forbidden" });
    const { itemId, vendorId } = req.body;
    try {
      await prisma.itemVendorMapping.delete({
        where: { itemId_vendorId: { itemId, vendorId } }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Mapping not found" });
    }
  });

  app.delete("/api/items/:id", authenticate, async (req: any, res) => {
    const itemId = req.params.id;
    if (req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden: Admin role required" });
    }

    try {
      // Direct delete
      await prisma.itemMaster.delete({
        where: { id: itemId }
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[ITEM DELETE] Error:", e);
      // Fallback: manual cleanup of related records
      try {
        await prisma.vendorRate.deleteMany({ where: { itemId } });
        await prisma.purchaseOrderItem.deleteMany({ where: { itemId } });
        await prisma.bOQLineItem.deleteMany({ where: { itemId } });
        await prisma.itemMaster.delete({ where: { id: itemId } });
        res.json({ success: true, note: "Deleted via manual fallback" });
      } catch (fallbackErr: any) {
        res.status(500).json({ error: "Delete failed", details: fallbackErr.message });
      }
    }
  });

  // --- Invite Vendor for Item ---
  app.post("/api/items/:id/invite-vendor", authenticate, async (req, res) => {
    const { vendorId } = req.body;
    const itemId = req.params.id;
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    try {
      const [item, vendor] = await Promise.all([
        prisma.itemMaster.findUnique({ where: { id: itemId } }),
        prisma.vendor.findUnique({ where: { id: vendorId } })
      ]);

      if (!item || !vendor) return res.status(404).json({ error: "Item or Vendor not found" });

      const rate = await prisma.vendorRate.create({
        data: {
          itemId,
          vendorId,
          submittedRate: 0,
          status: "Pending",
          token
        }
      });

      const submissionUrl = `${process.env.APP_URL}/vendor-submit/${token}`;
      const emailBody = `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Rate Request - THE SUBTLEINFRA PVT LTD</h2>
          <p>Hello ${vendor.name},</p>
          <p>We are requesting a rate for the following item:</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Item:</strong> ${item.name}</p>
            <p><strong>Category:</strong> ${item.category}</p>
            <p><strong>Unit:</strong> ${item.unit}</p>
          </div>
          <p>Please use the link below to submit your best rate for this item:</p>
          <div style="margin: 20px 0;">
            <a href="${submissionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Submit Rate</a>
          </div>
        </div>
      `;

      await sendEmail(vendor.email, `Rate Request for ${item.name} - THE SUBTLEINFRA PVT LTD`, emailBody);

      res.json({ success: true, submissionUrl });
    } catch (e) {
      res.status(500).json({ error: "Failed to send invite" });
    }
  });

  // --- Client Routes ---
  app.get("/api/clients", authenticate, async (req, res) => {
    try {
      const clients = await prisma.client.findMany({
        include: { boqs: true, inflows: true }
      });
      res.json(clients);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", authenticate, async (req, res) => {
    const { name, email, contactInfo } = req.body;
    console.log(`[CLIENT CREATE] Attempting to create client: ${email}`);
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    try {
      const client = await prisma.client.create({
        data: { name, email, contactInfo }
      });
      console.log(`[CLIENT CREATE] Success: ${client.id}`);
      res.json(client);
    } catch (e: any) {
      console.error(`[CLIENT CREATE] Error:`, e);
      if (e.code === 'P2002') {
        return res.status(400).json({ error: "Client with this email already exists" });
      }
      res.status(500).json({ error: "Failed to create client", details: e.message });
    }
  });

  app.delete("/api/boqs/:id", authenticate, async (req: any, res) => {
    try {
      const boq = await prisma.bOQ.findUnique({
        where: { id: req.params.id },
        include: { pos: true, inflows: true, outflows: true }
      });

      if (!boq) return res.status(404).json({ error: "BOQ not found" });

      if (boq.status === "Approved" && req.user.role !== "Admin") {
        return res.status(403).json({ error: "Only admins can delete approved BOQs" });
      }

      if (boq.pos.length || boq.inflows.length || boq.outflows.length) {
        return res.status(400).json({ error: "Cannot delete BOQ with linked POs or payments" });
      }

      await prisma.$transaction([
        prisma.approval.deleteMany({ where: { boqId: req.params.id } }),
        prisma.progressUpdate.deleteMany({ where: { lineItem: { boqId: req.params.id } } }),
        prisma.bOQLineItem.deleteMany({ where: { boqId: req.params.id } }),
        prisma.bOQ.delete({ where: { id: req.params.id } })
      ]);

      res.json({ success: true });
    } catch (e) {
      console.error("Delete BOQ error:", e);
      res.status(500).json({ error: "Failed to delete BOQ" });
    }
  });

  app.put("/api/clients/:id", authenticate, async (req, res) => {
    const { name, email, contactInfo } = req.body;
    try {
      const client = await prisma.client.update({
        where: { id: req.params.id },
        data: { name, email, contactInfo }
      });
      res.json(client);
    } catch (e) {
      res.status(400).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", authenticate, async (req, res) => {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.params.id },
        include: { boqs: true }
      });
      if (client?.boqs.length) {
        return res.status(400).json({ error: "Cannot delete client with active projects" });
      }
      await prisma.client.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Failed to delete client" });
    }
  });

  // --- Cash Flow Routes ---
  app.get("/api/cash-flow", authenticate, async (req, res) => {
    try {
      const inflows = await prisma.inflow.findMany({
        include: { client: true, boq: true },
        orderBy: { date: 'desc' }
      });
      const vendorPayments = await prisma.payment.findMany({
        include: { 
          invoice: { 
            include: { 
              purchaseOrder: { 
                include: { vendor: true } 
              } 
            } 
          } 
        },
        orderBy: { paymentDate: 'desc' }
      });
      const generalOutflows = await prisma.outflow.findMany({
        include: { vendor: true, purchaseOrder: true },
        orderBy: { date: 'desc' }
      });
      res.json({ inflows, vendorPayments, generalOutflows });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch cash flow data" });
    }
  });

  app.post("/api/inflows", authenticate, async (req, res) => {
    const { clientId, boqId, amount, description, method } = req.body;
    try {
      const inflow = await prisma.inflow.create({
        data: {
          clientId,
          boqId: boqId || null,
          amount: parseFloat(amount),
          description,
          method,
          date: new Date()
        }
      });
      res.json(inflow);
    } catch (e) {
      res.status(400).json({ error: "Failed to record inflow" });
    }
  });

  app.post("/api/outflows", authenticate, async (req, res) => {
    const { vendorId, amount, description, method, category, poId, boqId, date } = req.body;
    
    // Ensure empty strings are treated as null for database relations
    const data = {
      vendorId: vendorId || null,
      poId: poId || null,
      boqId: boqId || null,
      amount: parseFloat(amount),
      description,
      method,
      category,
      date: date ? new Date(date) : new Date()
    };

    console.log("[Outflow] Recording outflow:", data);

    try {
      const outflow = await prisma.outflow.create({ data });
      console.log("[Outflow] Recorded successfully:", outflow.id);
      res.json(outflow);
    } catch (e: any) {
      console.error("[Outflow] Error details:", e);
      res.status(400).json({ error: "Failed to record outflow", details: e.message });
    }
  });

  // --- Invoice Admin Routes ---
  app.get("/api/invoices", authenticate, async (req, res) => {
    try {
      const invoices = await prisma.invoice.findMany({
        include: { 
          purchaseOrder: { include: { vendor: true } },
          vendor: true,
          payments: true
        },
        orderBy: { submittedAt: 'desc' }
      });
      res.json(invoices);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.patch("/api/invoices/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Procurement") return res.status(403).json({ error: "Forbidden" });
    const { status, certifiedAmount, tdsAmount } = req.body;
    try {
      const invoice = await prisma.invoice.update({
        where: { id: req.params.id },
        data: { 
          status,
          certifiedAmount: certifiedAmount !== undefined ? parseFloat(certifiedAmount) : undefined,
          tdsAmount: tdsAmount !== undefined ? parseFloat(tdsAmount) : undefined
        }
      });
      res.json(invoice);
    } catch (e) {
      res.status(400).json({ error: "Failed to update invoice" });
    }
  });

  // --- Payment Admin Routes ---
  app.post("/api/payments", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Procurement") return res.status(403).json({ error: "Forbidden" });
    const { invoiceId, amount, method, transactionId, paymentDate } = req.body;
    try {
      const payment = await prisma.payment.create({
        data: {
          invoiceId,
          amount: parseFloat(amount),
          method,
          transactionId,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date()
        }
      });

      // Check if invoice is fully paid
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        if (totalPaid >= invoice.amount) {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: "Paid" }
          });
        }
      }

      res.json(payment);
    } catch (e) {
      res.status(400).json({ error: "Failed to record payment" });
    }
  });

  // --- Vendor Routes ---
  app.post("/api/vendors", authenticate, async (req, res) => {
    const { name, email, contactInfo, state } = req.body;
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    try {
      const vendor = await prisma.vendor.create({
        data: { name, email, contactInfo, state: state || "Maharashtra", token },
      });

      // Send real email
      const submissionUrl = `${process.env.APP_URL}/vendor-setup/${token}`;
      const portalUrl = `${process.env.APP_URL}/vendor-portal/${token}`;
      const emailBody = `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Welcome to THE SUBTLEINFRA PVT LTD</h2>
          <p>Hello ${name},</p>
          <p>We would like to invite you to join our vendor network. Please use the link below to complete your profile and submit your product rates.</p>
          <div style="margin: 20px 0;">
            <a href="${submissionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">Complete Onboarding</a>
            <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Vendor Portal</a>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">Bookmark your Vendor Portal link to view your Purchase Orders in the future: ${portalUrl}</p>
        </div>
      `;
      
      await sendEmail(email, "Invitation to Onboard - THE SUBTLEINFRA PVT LTD", emailBody);

      res.json({ vendor, submissionUrl, portalUrl });
    } catch (e) {
      res.status(400).json({ error: "Vendor with this email already exists" });
    }
  });

  app.delete("/api/vendors/:id", authenticate, async (req: any, res) => {
    const vendorId = req.params.id;
    console.log(`[CRITICAL DELETE] Request for ID: ${vendorId} by ${req.user.email}`);
    
    if (req.user.role !== "Approver") {
      return res.status(403).json({ error: "Forbidden: Approver role required" });
    }

    try {
      // Direct delete - let's see if this works first
      await prisma.vendor.delete({
        where: { id: vendorId }
      });
      console.log(`[CRITICAL DELETE] Success for ${vendorId}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[CRITICAL DELETE] Error:", e);
      // Fallback: manual cleanup if direct delete fails
      try {
        await prisma.vendorRate.deleteMany({ where: { vendorId } });
        await prisma.purchaseOrderItem.deleteMany({ 
          where: { purchaseOrder: { vendorId } } 
        });
        await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
        await prisma.vendor.delete({ where: { id: vendorId } });
        res.json({ success: true, note: "Deleted via manual fallback" });
      } catch (fallbackErr: any) {
        res.status(500).json({ error: "Delete failed", details: fallbackErr.message });
      }
    }
  });

  app.get("/api/vendors", authenticate, async (req, res) => {
    try {
      const vendors = await prisma.vendor.findMany();
      res.json(vendors);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  // --- Multi-Item Vendor Submission (Public) ---
  app.get("/api/public/vendor-setup/:token", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token },
        include: { rates: { include: { item: true } } }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });
      
      const items = await prisma.itemMaster.findMany();
      res.json({ vendor, items });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor setup data" });
    }
  });

  app.post("/api/public/vendor-setup/:token", async (req, res) => {
    const { contactInfo, rates, customItems } = req.body; 
    try {
      const vendor = await prisma.vendor.findUnique({ where: { token: req.params.token } });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { contactInfo }
      });

      // Handle existing items
      for (const r of rates) {
        const existingRate = await prisma.vendorRate.findFirst({
          where: { vendorId: vendor.id, itemId: r.itemId }
        });

        if (existingRate) {
          await prisma.vendorRate.update({
            where: { id: existingRate.id },
            data: { submittedRate: r.submittedRate, status: "Pending Review" }
          });
        } else {
          await prisma.vendorRate.create({
            data: {
              vendorId: vendor.id,
              itemId: r.itemId,
              submittedRate: r.submittedRate,
              activeRate: r.submittedRate,
              status: "Pending Review"
            }
          });
        }
      }

      // Handle custom items
      if (customItems && Array.isArray(customItems)) {
        for (const ci of customItems) {
          await prisma.vendorRate.create({
            data: {
              vendorId: vendor.id,
              vendorItemName: ci.name,
              vendorCategory: ci.category,
              vendorUnit: ci.unit,
              submittedRate: ci.rate,
              activeRate: ci.rate,
              status: "Pending Review"
            }
          });
        }
      }

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to submit vendor setup" });
    }
  });

  app.post("/api/vendor-rates/:id/approve", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Procurement") return res.status(403).json({ error: "Forbidden" });
    const { negotiatedRate } = req.body;
    
    try {
      const rate = await prisma.vendorRate.findUnique({ 
        where: { id: req.params.id },
        include: { vendor: true }
      });
      if (!rate) return res.status(404).json({ error: "Rate not found" });

      let itemId = rate.itemId;

      // If it's a new item, create it in ItemMaster first
      if (!itemId && rate.vendorItemName) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const generatedCode = `AUTO-${timestamp}-${random}`;

        const newItem = await prisma.itemMaster.create({
          data: {
            itemCode: generatedCode,
            name: rate.vendorItemName,
            category: rate.vendorCategory || "General",
            unit: rate.vendorUnit || "NOS",
            stateRates: {
              create: [
                { 
                  state: rate.vendor.state, 
                  supplyPlusInstallationRate: negotiatedRate || rate.submittedRate,
                  labourRate: 0,
                  supplyOnlyRate: 0
                }
              ]
            }
          }
        });
        itemId = newItem.id;
      }

      await prisma.vendorRate.update({
        where: { id: req.params.id },
        data: {
          itemId,
          negotiatedRate,
          activeRate: negotiatedRate || rate.submittedRate,
          status: "Active"
        }
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to approve rate" });
    }
  });

  app.post("/api/boqs/:id/create-po", authenticate, async (req, res) => {
    const boqId = req.params.id;
    console.log(`Generating POs for BOQ ID: ${boqId}`);
    try {
      const boq = await prisma.bOQ.findUnique({
        where: { id: boqId },
        include: { lineItems: { include: { item: true } } }
      });

      if (!boq) {
        return res.status(404).json({ error: "BOQ not found" });
      }

      if (boq.status !== "Approved") {
        return res.status(400).json({ error: `Only approved BOQs can generate POs. Current status: ${boq.status}` });
      }

      // Group items by vendor with lowest rate
      const vendorGroups: Record<string, any[]> = {};
      const settings = await prisma.settings.findUnique({ where: { id: "default" } });
      let nextPoNumber = settings?.poNextNumber || 1;
      const poSeries = settings?.poSeries || "PO";

      for (const li of boq.lineItems) {
        // Find the lowest active rate for this item
        const lowestRate = await prisma.vendorRate.findFirst({
          where: { 
            itemId: li.itemId, 
            status: "Active"
          },
          orderBy: { activeRate: 'asc' },
          include: { vendor: true }
        });

        if (lowestRate && lowestRate.activeRate !== null && lowestRate.activeRate !== undefined) {
          const vendorId = lowestRate.vendorId;
          if (!vendorGroups[vendorId]) vendorGroups[vendorId] = [];
          
          const qty = li.quantity;
          const rate = lowestRate.activeRate;
          const gstRate = li.gstRate || 0;
          const subTotal = qty * rate;
          const gstAmount = subTotal * (gstRate / 100);

          vendorGroups[vendorId].push({
            itemId: li.itemId,
            quantity: qty,
            rate: rate,
            gstRate: gstRate,
            gstAmount: gstAmount,
            total: subTotal + gstAmount
          });
        }
      }

      if (Object.keys(vendorGroups).length === 0) {
        return res.status(400).json({ error: "No active vendor rates found for the items in this BOQ. Please ensure vendors have submitted active rates." });
      }

      const createdPos = [];
      for (const [vendorId, items] of Object.entries(vendorGroups)) {
        const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
        const totalAmount = subTotal + gstAmount;
        const poNumber = `${poSeries}-${nextPoNumber.toString().padStart(3, '0')}`;

        const po = await prisma.purchaseOrder.create({
          data: {
            boqId,
            vendorId,
            poNumber,
            subTotal,
            gstAmount,
            totalAmount,
            status: "Draft",
            items: {
              create: items.map(i => ({
                itemId: i.itemId,
                quantity: i.quantity,
                rate: i.rate,
                gstRate: i.gstRate,
                gstAmount: i.gstAmount,
                total: i.total
              }))
            }
          }
        });
        createdPos.push(po);
        nextPoNumber++;
      }

      // Update settings with the next PO number
      await prisma.settings.update({
        where: { id: "default" },
        data: { poNextNumber: nextPoNumber }
      });

      console.log(`Successfully created ${createdPos.length} POs`);
      res.json({ success: true, count: createdPos.length });
    } catch (e: any) {
      console.error("Failed to create POs:", e);
      res.status(500).json({ error: `Failed to create POs: ${e.message}` });
    }
  });

  app.get("/api/purchase-orders", authenticate, async (req, res) => {
    try {
      const pos = await prisma.purchaseOrder.findMany({
        include: { 
          vendor: true, 
          boq: true,
          payments: true,
          outflows: true,
          items: { include: { item: true } },
          invoices: {
            include: { payments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(pos);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

  app.put("/api/purchase-orders/:id", authenticate, async (req, res) => {
    const { status, terms, items } = req.body;
    try {
      if (items) {
        // First delete existing items
        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: req.params.id } });
        
        // Recalculate totals
        let subTotal = 0;
        let totalGst = 0;
        const itemsWithGst = items.map((item: any) => {
          const qty = parseFloat(item.quantity);
          const rate = parseFloat(item.rate);
          const gstRate = parseFloat(item.gstRate || "0");
          const lineSubTotal = qty * rate;
          const lineGst = lineSubTotal * (gstRate / 100);
          subTotal += lineSubTotal;
          totalGst += lineGst;
          return {
            purchaseOrderId: req.params.id,
            itemId: item.itemId || null,
            description: item.description,
            quantity: qty,
            unit: item.unit || "Nos",
            rate: rate,
            gstRate: gstRate,
            gstAmount: lineGst,
            total: lineSubTotal + lineGst
          };
        });

        await prisma.purchaseOrderItem.createMany({ data: itemsWithGst });
        
        await prisma.purchaseOrder.update({
          where: { id: req.params.id },
          data: { status, terms, subTotal, gstAmount: totalGst, totalAmount: subTotal + totalGst }
        });
      } else {
        await prisma.purchaseOrder.update({
          where: { id: req.params.id },
          data: { status, terms }
        });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Error updating PO:", e);
      res.status(500).json({ error: "Failed to update PO" });
    }
  });

  app.delete("/api/purchase-orders/:id", authenticate, async (req, res) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: req.params.id },
        include: { outflows: true, invoices: true }
      });
      
      if (po?.outflows.length || po?.invoices.length) {
        return res.status(400).json({ error: "Cannot delete PO with linked payments or invoices" });
      }

      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: req.params.id } });
      await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete PO" });
    }
  });

  app.post("/api/purchase-orders", authenticate, async (req, res) => {
    const { vendorId, boqId, totalAmount, items, terms } = req.body;
    try {
      // Get settings for PO number
      const settings = await prisma.settings.findUnique({ where: { id: "default" } });
      const poSeries = settings?.poSeries || "PO";
      const poNextNumber = settings?.poNextNumber || 1;
      const poNumber = `${poSeries}-${poNextNumber.toString().padStart(3, '0')}`;
      const defaultTerms = settings?.poTerms || "";

      // Calculate subtotal and GST
      let subTotal = 0;
      let totalGst = 0;
      const itemsWithGst = items.map((item: any) => {
        const qty = parseFloat(item.quantity);
        const rate = parseFloat(item.rate);
        const gstRate = parseFloat(item.gstRate || "0");
        const lineSubTotal = qty * rate;
        const lineGst = lineSubTotal * (gstRate / 100);
        subTotal += lineSubTotal;
        totalGst += lineGst;
        return {
          itemId: item.itemId,
          quantity: qty,
          rate: rate,
          gstRate: gstRate,
          gstAmount: lineGst,
          total: lineSubTotal + lineGst
        };
      });

      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          vendorId,
          boqId: boqId || null,
          subTotal,
          gstAmount: totalGst,
          totalAmount: subTotal + totalGst,
          status: "Sent",
          terms: terms || defaultTerms,
          items: {
            create: itemsWithGst
          }
        },
        include: { 
          vendor: true, 
          boq: true,
          payments: true,
          outflows: true,
          invoices: {
            include: { payments: true }
          }
        }
      });

      // Increment PO number in settings
      await prisma.settings.update({
        where: { id: "default" },
        data: { poNextNumber: poNextNumber + 1 }
      });

      res.json(po);
    } catch (e: any) {
      console.error("Error creating PO:", e);
      res.status(500).json({ error: "Failed to create PO", details: e.message });
    }
  });

  // --- Vendor Submission (Public) ---
  app.get("/api/public/vendor-rate/:token", async (req, res) => {
    try {
      const rate = await prisma.vendorRate.findUnique({
        where: { token: req.params.token },
        include: { item: true, vendor: true }
      });
      if (!rate) return res.status(404).json({ error: "Invalid link" });
      res.json(rate);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor rate" });
    }
  });

  app.post("/api/public/vendor-rate/:token", async (req, res) => {
    const { submittedRate } = req.body;
    const rateValue = parseFloat(submittedRate);
    
    if (isNaN(rateValue)) {
      return res.status(400).json({ error: "Invalid rate value" });
    }

    try {
      await prisma.vendorRate.update({
        where: { token: req.params.token },
        data: { submittedRate: rateValue, status: "Pending Review" }
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error submitting vendor rate:", e);
      res.status(500).json({ error: "Failed to submit rate" });
    }
  });

  // --- Vendor Portal (Public/Token-based) ---
  app.get("/api/public/vendor-portal/:token", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });
      res.json(vendor);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor portal data" });
    }
  });

  app.get("/api/public/vendor-portal/:token/pos", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const pos = await prisma.purchaseOrder.findMany({
        where: { vendorId: vendor.id },
        include: { boq: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(pos);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor POs" });
    }
  });

  app.get("/api/public/vendor-portal/:token/pos/:poId", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const po = await prisma.purchaseOrder.findFirst({
        where: { id: req.params.poId, vendorId: vendor.id },
        include: { 
          boq: true,
          items: { include: { item: true } }
        }
      });
      if (!po) return res.status(404).json({ error: "PO not found" });
      res.json(po);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor PO details" });
    }
  });

  app.get("/api/public/vendor-portal/:token/invoices", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const invoices = await prisma.invoice.findMany({
        where: { vendorId: vendor.id },
        include: { purchaseOrder: true },
        orderBy: { submittedAt: 'desc' }
      });
      res.json(invoices);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor invoices" });
    }
  });

  app.post("/api/public/vendor-portal/:token/invoices", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const { purchaseOrderId, invoiceNumber, amount, fileUrl } = req.body;
      
      const invoice = await prisma.invoice.create({
        data: {
          vendorId: vendor.id,
          purchaseOrderId,
          invoiceNumber,
          amount: parseFloat(amount),
          fileUrl,
          status: "Pending"
        }
      });
      res.json(invoice);
    } catch (e) {
      res.status(400).json({ error: "Invoice number already exists or invalid data" });
    }
  });


  // --- Vendor Portal Public Routes (Extended) ---
  app.get("/api/public/vendor-portal/:token/items", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const items = await prisma.itemMaster.findMany({
        include: {
          stateRates: {
            where: { state: vendor.state || "Maharashtra" }
          }
        },
        orderBy: { name: 'asc' }
      });
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.get("/api/public/vendor-portal/:token/rates", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const rates = await prisma.vendorRate.findMany({
        where: { vendorId: vendor.id },
        include: { item: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(rates);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor rates" });
    }
  });

  app.post("/api/public/vendor-portal/:token/rates", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const { itemId, vendorItemName, vendorCategory, submittedRate, vendorUnit, remarks } = req.body;
      const rateValue = parseFloat(submittedRate);

      if (isNaN(rateValue)) {
        return res.status(400).json({ error: "Invalid rate value" });
      }
      
      const rate = await prisma.vendorRate.create({
        data: {
          vendorId: vendor.id,
          itemId: itemId === 'new' ? null : (itemId || null),
          vendorItemName: itemId === 'new' ? vendorItemName : null,
          vendorCategory: itemId === 'new' ? vendorCategory : null,
          submittedRate: rateValue,
          vendorUnit,
          remarks,
          status: "Pending Review"
        }
      });
      res.json(rate);
    } catch (e) {
      console.error("Error submitting vendor portal rate:", e);
      res.status(400).json({ error: "Failed to submit rate" });
    }
  });

  app.patch("/api/public/vendor-portal/:token/rates/:id", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const { submittedRate, vendorUnit, remarks } = req.body;
      
      const rate = await prisma.vendorRate.update({
        where: { id: req.params.id, vendorId: vendor.id },
        data: {
          submittedRate: parseFloat(submittedRate),
          vendorUnit,
          remarks,
          status: "Pending" // Reset to pending on update
        }
      });
      res.json(rate);
    } catch (e) {
      res.status(400).json({ error: "Failed to update rate" });
    }
  });

  app.get("/api/public/vendor-portal/:token/payments", async (req, res) => {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { token: req.params.token }
      });
      if (!vendor) return res.status(404).json({ error: "Invalid link" });

      const payments = await prisma.payment.findMany({
        where: { invoice: { vendorId: vendor.id } },
        include: { invoice: { include: { purchaseOrder: true } } },
        orderBy: { paymentDate: 'desc' }
      });
      res.json(payments);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor payments" });
    }
  });


  app.get("/api/vendor-rates", authenticate, async (req, res) => {
    try {
      const rates = await prisma.vendorRate.findMany({
        include: { 
          vendor: true,
          item: true 
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(rates);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor rates" });
    }
  });

  app.patch("/api/vendor-rates/:id", authenticate, async (req: any, res) => {
    if (req.user.role === "Viewer") return res.status(403).json({ error: "Forbidden" });
    const { status, remarks, submittedRate, vendorUnit } = req.body;
    try {
      const rate = await prisma.vendorRate.update({
        where: { id: req.params.id },
        data: { 
          status, 
          remarks,
          submittedRate: submittedRate ? parseFloat(submittedRate) : undefined,
          vendorUnit
        }
      });
      res.json(rate);
    } catch (e) {
      res.status(400).json({ error: "Failed to update rate" });
    }
  });

  app.post("/api/vendor-rates/:id/convert", authenticate, async (req: any, res) => {
    if (req.user.role !== "Admin" && req.user.role !== "Estimator") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const vendorRate = await prisma.vendorRate.findUnique({
      where: { id: req.params.id },
      include: { vendor: true }
    });

    if (!vendorRate || !vendorRate.vendorItemName) {
      return res.status(400).json({ error: "Invalid vendor rate or item already in master" });
    }

    try {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const generatedCode = `VND-${timestamp}-${random}`;

      // Create new item in master
      const newItem = await prisma.itemMaster.create({
        data: {
          itemCode: generatedCode,
          name: vendorRate.vendorItemName,
          category: vendorRate.vendorCategory || "Uncategorized",
          unit: vendorRate.vendorUnit || "NOS",
          status: "Active",
          // Add default state rate for the vendor's state if applicable
          stateRates: {
            create: {
              state: vendorRate.vendor.state,
              supplyOnlyRate: vendorRate.submittedRate,
              labourRate: 0,
              supplyPlusInstallationRate: vendorRate.submittedRate
            }
          }
        }
      });

      // Update vendor rate to point to the new master item
      await prisma.vendorRate.update({
        where: { id: vendorRate.id },
        data: {
          itemId: newItem.id,
          vendorItemName: null,
          vendorCategory: null,
          status: "Active",
          activeRate: vendorRate.submittedRate
        }
      });

      res.json(newItem);
    } catch (e) {
      res.status(400).json({ error: "Failed to convert item" });
    }
  });

  // --- Vendor Mapping Routes ---
  app.get("/api/vendor-mappings", authenticate, async (req, res) => {
    try {
      const mappings = await prisma.itemVendorMapping.findMany({
        include: { item: true, vendor: true }
      });
      res.json(mappings);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vendor mappings" });
    }
  });

  app.post("/api/vendor-mappings", authenticate, async (req, res) => {
    const { itemId, vendorId } = req.body;
    try {
      const mapping = await prisma.itemVendorMapping.create({
        data: { itemId, vendorId }
      });
      res.json(mapping);
    } catch (e) {
      res.status(400).json({ error: "Mapping already exists" });
    }
  });

  app.delete("/api/vendor-mappings/:id", authenticate, async (req, res) => {
    try {
      await prisma.itemVendorMapping.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete mapping" });
    }
  });

  app.get("/api/items/stats", authenticate, async (req, res) => {
    try {
      const totalItems = await prisma.itemMaster.count();
      const totalCategories = await prisma.itemMaster.groupBy({ by: ['category'] });
      const totalVendorsMapped = await prisma.itemVendorMapping.count();
      const activeItems = await prisma.itemMaster.count({ where: { status: 'Active' } });
      const recentlyUpdated = await prisma.itemMaster.count({
        where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      });

      res.json({
        totalItems,
        categoriesCount: totalCategories.length,
        totalVendorsMapped,
        activeItems,
        recentlyUpdated
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch items stats" });
    }
  });

  // --- Global Error Handler ---
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[GLOBAL ERROR]", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
