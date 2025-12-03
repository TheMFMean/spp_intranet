// /srv/backend/config/SaferVendorEmailConfig.js
//
// Safer vendor email classification config.
// This does NOT replace vendorEmailConfig.js (which is used for Gmail search, etc).
// It is a separate, stricter layer used by the classifier to decide whether
// a given message is an order lifecycle email or noise.

const saferVendorEmailConfig = [
    {
        vendorId: "cascade",
        displayName: "Cascade Body Jewelry",
        fromIncludes: [
            "cascadebodyjewelry.com",
            "cascade body jewelry",
            "cascade",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmed",
                "thank you for your order",
                "order #",
                "invoice #",
            ],
            shipped: [
                "your order has shipped",
                "shipment has shipped",
                "items in this shipment",
                "shipping confirmation",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
                "is out for delivery",
            ],
            delivered: [
                "has been delivered",
                "your order was delivered",
                "delivery confirmation",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
                "order has been cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
                "credit memo",
            ],
        },
        ignoreIfSubjectIncludes: [
            "sale",
            "newsletter",
            "new arrivals",
            "promo",
            "promotion",
            "special offer",
            "marketing",
        ],
    },

    {
        vendorId: "jtw",
        displayName: "JTW, LLC",
        fromIncludes: [
            "jtw, llc",
            "jewelry-this-way.myshopify.com",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmed",
                "thank you for your purchase",
                "thank you for your order",
                "order #",
            ],
            shipped: [
                "a shipment from order",
                "your order is on the way",
                "is on the way",
                "has shipped",
                "shipment notification",
            ],
            out_for_delivery: [
                "out for delivery",
                "is out for delivery",
            ],
            delivered: [
                "has been delivered",
                "your order has been delivered",
                "delivery update",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
                "has been cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
                "credit issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "sale",
            "newsletter",
            "new arrivals",
            "marketing",
            "update your preferences",
        ],
    },

    {
        vendorId: "oracle",
        displayName: "Oracle Body Jewelry",
        fromIncludes: [
            "oraclebodyjewelry",
            "oracle body jewelry",
            "oracle",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "order confirmed",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipment notification",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
            "special offer",
        ],
    },

    {
        vendorId: "quetzalli",
        displayName: "Quetzalli Jewelry",
        fromIncludes: [
            "quetzalli",
            "quetzallijewelry",
            "quetzallijewelry.com",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "thank you for your order",
                "order confirmation",
                "order confirmed",
            ],
            shipped: [
                "your order has shipped",
                "shipment for order",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "order has been delivered",
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "lookbook",
            "sale",
            "promo",
        ],
    },

    {
        vendorId: "tether",
        displayName: "Tether Jewelry",
        fromIncludes: [
            "tetherjewelry",
            "tether jewelry",
            "tetherjewelry.com",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipment notification",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "new collection",
            "sale",
            "wholesale update",
        ],
    },

    {
        vendorId: "regalia",
        displayName: "Regalia Jewelry",
        fromIncludes: [
            "regalia",
            "regalia jewelry",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipment notification",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
            "new arrivals",
        ],
    },

    {
        vendorId: "ember",
        displayName: "Ember Body Jewelry",
        fromIncludes: [
            "ember",
            "ember body jewelry",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipment notification",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
        ],
    },

    {
        vendorId: "isc",
        displayName: "Industrial Strength",
        fromIncludes: [
            "industrialstrengthbodyjewelry",
            "industrial strength",
            "isc",
            "shopifyemail.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "thanks for your order",
                "thank you for your order",
                "order id #",
            ],
            shipped: [
                "shipment for order",
                "your order has shipped",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
            "new catalog",
        ],
    },

    {
        vendorId: "anatometal",
        displayName: "Anatometal",
        fromIncludes: [
            "anatometal",
            "anatometal.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "has shipped",
                "your order has shipped",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
        ],
    },

    {
        vendorId: "glasswear",
        displayName: "Glasswear Studios",
        fromIncludes: [
            "glasswearstudios",
            "glasswear studios",
            "glasswear",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipping confirmation",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
        ],
    },

    {
        vendorId: "neometal",
        displayName: "NeoMetal",
        fromIncludes: [
            "neometal",
            "neometal.com",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipping confirmation",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
        ],
    },

    {
        vendorId: "crucial_diablo",
        displayName: "Crucial / Diablo",
        fromIncludes: [
            "crucial",
            "crucialbodyjewelry",
            "diablo",
            "jimmy buddha",
        ],
        toIncludes: ["jewelryorders@sodapoppiercing.com"],
        lifecycleMarkers: {
            confirmed: [
                "order confirmation",
                "thank you for your order",
            ],
            shipped: [
                "your order has shipped",
                "shipment notification",
                "tracking number",
            ],
            out_for_delivery: [
                "out for delivery",
            ],
            delivered: [
                "has been delivered",
                "delivered",
            ],
            canceled: [
                "order canceled",
                "order cancelled",
            ],
            refunded: [
                "has been refunded",
                "refund issued",
            ],
        },
        ignoreIfSubjectIncludes: [
            "newsletter",
            "sale",
            "promo",
            "new arrivals",
        ],
    },
];

export {
    saferVendorEmailConfig,
};
