import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAllContacts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const CurrentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!CurrentUser) throw new Error("User not found");

    const expensesYouPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", CurrentUser._id).eq("groupId", undefined)
      )
      .collect();

    const expensesNotYouPaid = (await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", undefined))
      .collect()).filter(
      (e) =>
        e.paidByUserId !== CurrentUser._id &&
        e.splits.some((s) => s.userId === CurrentUser._id)
    );

    const personalExpenses = [...expensesYouPaid, ...expensesNotYouPaid];
    const contactIds = new Set();
    personalExpenses.forEach((expense) => {
      if (expense.paidByUserId !== CurrentUser._id) {
        contactIds.add(expense.paidByUserId);
      }
      expense.splits.forEach((split) => {
        if (split.userId !== CurrentUser._id) {
          contactIds.add(split.userId);
        }
      });
    });

    const contactUsers = await Promise.all(
      [...contactIds].map(async (id) => {
        const u = await ctx.db.get(id);
        return u
          ? {
              id: u._id,
              name: u.name,
              email: u.email,
              imageUrl: u.imageUrl,
              type: "user",
            }
          : null;
      })
    );

    const userGroups = (await ctx.db.query("groups").collect())
      .filter((g) =>
        g.members.some((m) => m.userId === CurrentUser._id)
      )
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
        type: "group",
      }));

    contactUsers.sort((a, b) => a.name.localeCompare(b?.name));
    userGroups.sort((a, b) => a.name.localeCompare(b.name));
    return {
      users: contactUsers.filter(Boolean),
      groups: userGroups,
    };
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const CurrentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!CurrentUser) throw new Error("User not found");

    if (!args.name.trim()) throw new Error("Group name cannot be empty");

    const uniqueMembers = new Set(args.members);
    uniqueMembers.add(CurrentUser._id);
    for (const id of uniqueMembers) {
      if (!(await ctx.db.get(id))) {
        throw new Error(`User with id ${id} does not exist`);
      }
    }

    return await ctx.db.insert("groups", {
      name: args.name,
      description: args.description?.trim() ?? "",
      createdBy: CurrentUser._id,
      members: [...uniqueMembers].map((id) => ({
        userId: id,
        role: id === CurrentUser._id ? "admin" : "member",
        joinedAt: Date.now(),
      })),
    });
  },
});
