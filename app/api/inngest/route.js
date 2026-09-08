// import { serve } from "inngest/next";
// import { inngest } from "@/lib/inngest/client";
// import { paymentReminders } from "@/lib/inngest/payment-reminders";
// import { spendingInsights } from "@/lib/inngest/spending-insights";

// // Create an API that serves zero functions
// export const { GET, POST, PUT } = serve({ //PUT remove by me
//   client: inngest,
//   functions: [
//     /* your functions will be passed here later! */
//     spendingInsights,
//     paymentReminders,
//   ],
// });
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { paymentReminders } from "@/lib/inngest/payment-reminders";
import { spendingInsights } from "@/lib/inngest/spending-insights";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    spendingInsights,
    paymentReminders,
  ],
});
