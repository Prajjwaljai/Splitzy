import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { inngest } from "./client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const spendingInsights = inngest.createFunction(
  {
    name: "Generate Spending Insights",
    id: "generate-spending-insights",
  },
  { cron: "0 8 1 * *" }, // 1st of every month at 08:00 UTC
  async ({ step }) => {
    /* 1. Fetch users with expenses */
    const users = await step.run("Fetch users with expenses", async () => {
      return await convex.query(api.inngest.getUsersWithExpenses);
    });

    const results = [];

    /* 2. Process each user */
    for (const user of users) {
      const expenses = await step.run(`Expenses · ${user._id}`, async () => {
        return await convex.query(api.inngest.getUserMonthlyExpenses, {
          userId: user._id,
        });
      });

      if (!expenses?.length) continue;

      const expenseData = JSON.stringify({
        expenses,
        totalSpent: expenses.reduce((sum, e) => sum + e.amount, 0),
        categories: expenses.reduce((cats, e) => {
          const category = e.category ?? "uncategorised";
          cats[category] = (cats[category] ?? 0) + e.amount;
          return cats;
        }, {}),
      });

      const prompt = `
As a financial analyst, review this user's spending data for the past month and provide insightful observations and suggestions.

Focus on:
- spending patterns
- category breakdowns
- unusual spending
- saving opportunities
- actionable advice for better financial management

Use a friendly, encouraging tone.

Return clean HTML suitable for inserting directly inside an email body.
Do not include markdown code fences.

User spending data:
${expenseData}

Provide your analysis in these sections:
1. Monthly Overview
2. Top Spending Categories
3. Unusual Spending Patterns (if any)
4. Saving Opportunities
5. Recommendations for Next Month
      `.trim();

      try {
        /* 3. Generate AI insight */
        const htmlBody = await step.run(
          `Generate insight · ${user._id}`,
          async () => {
            const response = await model.generateContent(prompt);

            return (
              response.response.candidates?.[0]?.content?.parts?.[0]?.text ??
              ""
            );
          }
        );

        if (!htmlBody) {
          throw new Error("Gemini returned an empty response");
        }

        /* 4. Send email */
        await step.run(`Email · ${user._id}`, async () => {
          return await convex.action(api.email.sendEmail, {
            to: user.email,
            subject: "Your Monthly Spending Insights",
            html: `
              <h1>Your Monthly Financial Insights</h1>
              <p>Hi ${user.name ?? "there"},</p>
              <p>
                Here's your personalized spending analysis for the past month:
              </p>
              ${htmlBody}
            `,
            apiKey: process.env.RESEND_API_KEY,
          });
        });

        results.push({
          userId: user._id,
          success: true,
        });
      } catch (err) {
        console.error(`Spending insight failed for ${user._id}`, err);

        results.push({
          userId: user._id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      processed: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }
);