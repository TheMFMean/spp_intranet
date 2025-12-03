// services/quetzalliGuards.js

function getHeader(headers, name) {
    const match = headers.find(
        (h) => h.name && h.name.toLowerCase() === name.toLowerCase()
    );
    return match ? match.value || "" : "";
}

function isQuetzalliOrderEmail(headers, bodyText) {
    const from = getHeader(headers, "From");
    const subject = getHeader(headers, "Subject");

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();
    const bodyLower = (bodyText || "").toLowerCase();

    // 1. Must be from Quetzalli domain
    const isFromQuetzalli =
        fromLower.includes("@quetzallijewelry.com") ||
        fromLower.includes("contact@quetzallijewelry.com");

    if (!isFromQuetzalli) {
        return false;
    }

    // 2. Reject obvious marketing / noise subjects
    const noisePatterns = [
        "did something catch your eye",
        "spark",
        "10% off",
        "sale",
        "back in stock",
        "new collection",
        "newsletter",
    ];

    if (noisePatterns.some((p) => subjectLower.includes(p))) {
        return false;
    }

    // 3. Require order lifecycle phrases in subject or body
    const orderPatterns = [
        "order #",
        "order confirmed",
        "order confirmation",
        "your order is on the way",
        "your order has been shipped",
        "your order is out for delivery",
        "your order has been delivered",
        "your order has been canceled",
    ];

    const looksLikeOrder =
        orderPatterns.some((p) => subjectLower.includes(p)) ||
        orderPatterns.some((p) => bodyLower.includes(p));

    if (!looksLikeOrder) {
        return false;
    }

    return true;
}

export { isQuetzalliOrderEmail };
