
// Debug: log the domain to verify it's set
console.log("CLERK_JWT_ISSUER_DOMAIN:", process.env.CLERK_JWT_ISSUER_DOMAIN);

export default {
  providers: [
    {
      // This must match your Clerk JWT template Issuer URL
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
