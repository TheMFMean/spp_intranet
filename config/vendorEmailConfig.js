// config/vendorEmailConfig.js
// Safer vendor email config: avoid generic senders, focus on real vendor domains,
// and narrow subjects to actual order lifecycle mails.

const vendorEmailConfig = [
    {
        vendorId: "quetzalli",
        displayName: "Quetzalli Jewelry",
        // Only Quetzalli specific senders
        emailFromTokens: [
            "@quetzallijewelry.com",
            "contact@quetzallijewelry.com",
        ],
        // Only pull order lifecycle mails, not marketing blasts
        subjectQuery:
            '"Order #" OR "Order Confirmed" OR "Your Quetzalli Jewelry Order" OR "Your order is on the way" OR "Your order has been delivered" OR "Your order is out for delivery" OR "Your order has been canceled"',
        // Used by header matcher; keep these tight
        headerTokens: ["quetzallijewelry.com", "Quetzalli Jewelry"],
    },

    {
        vendorId: "oracle",
        displayName: "Oracle Body Jewelry",
        emailFromTokens: [
            "@oraclebodyjewelry.com",
            "noreply@oraclebodyjewelry.com",
            "orders@oraclebodyjewelry.com",
        ],
        subjectQuery:
            '"Order #" OR "Order Confirmed" OR "Order confirmation" OR "Your order has been shipped" OR "Your order has shipped" OR "out for delivery" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["oraclebodyjewelry.com", "Oracle Body Jewelry"],
    },

    {
        vendorId: "jtw",
        displayName: "Jewelery This Way",
        // Use the real domain(s) from the .eml samples here
        emailFromTokens: [
            "@jewelrythisway.com",
            "@jtwbodyjewelry.com",
        ],
        subjectQuery:
            '"Order #" OR "Order Confirmed" OR "Your order is on the way" OR "Your JTW order" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["jtw", "Jewelry This Way"],
    },

    {
        vendorId: "cascade",
        displayName: "Cascade Body Jewelry",
        emailFromTokens: [
            "@cascadebodyjewelry.com",
            "orders@cascadebodyjewelry.com",
        ],
        subjectQuery:
            '"Order #" OR "Order Confirmed" OR "Order confirmation" OR "Your order has shipped" OR "out for delivery" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["cascadebodyjewelry.com", "Cascade Body Jewelry"],
    },

    {
        vendorId: "crucial_diablo",
        displayName: "Crucial Tattoo / Diablo",
        emailFromTokens: [
            "@crucialtattoo.com",
            "@crucialdiablo.com",
            "orders@crucialdiablo.com",
        ],
        subjectQuery:
            '"Order #" OR "Order confirmation" OR "Your order has shipped" OR "Your Crucial order" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["crucialdiablo.com", "Crucial Diablo"],
    },

    {
        vendorId: "anatometal",
        displayName: "ANATOMETAL",
        emailFromTokens: [
            "@anatometal.com",
            "sales@anatometal.com",
            "orders@anatometal.com",
        ],
        subjectQuery:
            '"Invoice" OR "Order #" OR "Sales order" OR "has shipped" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["anatometal.com", "ANATOMETAL"],
    },

    {
        vendorId: "isc",
        displayName: "Industrial Strength",
        emailFromTokens: [
            "@industrialstrengthbodyjewelry.com",
            "@isbodyjewelry.com",
        ],
        subjectQuery:
            '"Order #" OR "Sales Order" OR "Invoice" OR "Your order has shipped" OR "has been delivered" OR "has been canceled"',
        headerTokens: ["industrialstrength", "Industrial Strength"],
    },
];

export { vendorEmailConfig };
