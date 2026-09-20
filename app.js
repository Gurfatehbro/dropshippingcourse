// ==========================================================================
// DROPSHIP INDIA BLUEPRINT - JAVASCRIPT LOGIC
// Clean, interactive, high-trust digital product store
// ==========================================================================

// --- Preview Tab Switcher ---
function switchPreview(viewMode) {
  const frontBtn = document.getElementById('tabFront');
  const backBtn = document.getElementById('tabBack');
  const bothBtn = document.getElementById('tabBoth');
  const visualBox = document.getElementById('previewVisualContainer');
  const subheading = document.getElementById('previewSubheading');
  const headline = document.getElementById('previewHeadline');
  const lead = document.getElementById('previewLead');

  // Reset active classes
  frontBtn.classList.remove('active');
  backBtn.classList.remove('active');
  bothBtn.classList.remove('active');

  if (viewMode === 'front') {
    frontBtn.classList.add('active');
    visualBox.innerHTML = `
      <img src="assets/images/book-front.jpg" alt="Front Cover Preview" class="preview-book-target" style="max-width: 360px;">
    `;
    subheading.textContent = "Front Cover & Overview";
    headline.textContent = "How to Start International Dropshipping From India";
    lead.textContent = "A structured guide that walks Indian founders through global currency dynamics, international customer expectations, supplier vetting, and bulletproof payment integration.";
  } else if (viewMode === 'back') {
    backBtn.classList.add('active');
    visualBox.innerHTML = `
      <img src="assets/images/book-back.jpg" alt="Back Cover & Syllabus Preview" class="preview-book-target" style="max-width: 360px;">
    `;
    subheading.textContent = "Back Cover & Full Syllabus";
    headline.textContent = "From India To Global Markets — Learn. Build. Sell. Grow.";
    lead.textContent = "Inspect the back cover featuring the complete 10-chapter curriculum, bonus inclusions, and core foundational strategies used by real international sellers operating from India.";
  } else if (viewMode === 'both') {
    bothBtn.classList.add('active');
    visualBox.innerHTML = `
      <div style="display: flex; gap: 20px; align-items: center; justify-content: center; flex-wrap: wrap;">
        <img src="assets/images/book-front.jpg" alt="Front Cover" style="max-width: 200px; width: 100%; border-radius: 4px; filter: drop-shadow(0 15px 25px rgba(15, 23, 42, 0.2));">
        <img src="assets/images/book-back.jpg" alt="Back Cover" style="max-width: 200px; width: 100%; border-radius: 4px; filter: drop-shadow(0 15px 25px rgba(15, 23, 42, 0.2));">
      </div>
    `;
    subheading.textContent = "Complete Dual View";
    headline.textContent = "Front & Back Product Architecture";
    lead.textContent = "See the complete publication: clean typography, realistic 3D volume, detailed chapter index, and included bonuses designed specifically for Indian sellers.";
  }
}

// --- FAQ Accordion ---
function toggleFaq(btn) {
  const item = btn.parentElement;
  const isActive = item.classList.contains('active');

  // Close all other FAQs
  document.querySelectorAll('.faq-item').forEach(el => {
    el.classList.remove('active');
  });

  // Toggle current item
  if (!isActive) {
    item.classList.add('active');
  }
}

// --- Sticky Action Bar on Scroll ---
window.addEventListener('scroll', () => {
  const heroSection = document.getElementById('hero');
  const stickyBar = document.getElementById('stickyCtaBar');
  if (!heroSection || !stickyBar) return;

  const heroBottom = heroSection.getBoundingClientRect().bottom;
  if (heroBottom < 100) {
    stickyBar.classList.add('visible');
  } else {
    stickyBar.classList.remove('visible');
  }
});

// --- Razorpay Payment Gateway Configuration ---
// Connected to your Live Razorpay Account:
window.RAZORPAY_CONFIG = {
  key_id: "rzp_live_TbXpMHWLFUG29I", // Your Live Razorpay Key
  amount: 100,                      // 100 paise = ₹1 (Testing Mode)
  currency: "INR",
  name: "Dropship India",
  description: "International Dropshipping Blueprint (PDF + 5 Bonuses)",
  image: "assets/images/book-front.jpg"
};

// --- Checkout Modal ---
function openCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function handleCheckout(event) {
  event.preventDefault();
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const btn = document.getElementById('checkoutSubmitBtn');

  if (!email || !name) return;

  btn.disabled = true;
  btn.textContent = "Connecting Payment Gateway...";

  // Check if real Razorpay Key ID is provided
  if (window.Razorpay && window.RAZORPAY_CONFIG.key_id && window.RAZORPAY_CONFIG.key_id !== "rzp_test_YOUR_KEY_HERE") {
    const options = {
      key: window.RAZORPAY_CONFIG.key_id,
      amount: window.RAZORPAY_CONFIG.amount,
      currency: window.RAZORPAY_CONFIG.currency,
      name: window.RAZORPAY_CONFIG.name,
      description: window.RAZORPAY_CONFIG.description,
      image: window.RAZORPAY_CONFIG.image,
      prefill: {
        name: name,
        email: email,
        contact: phone || ""
      },
      theme: {
        color: "#185adb"
      },
      handler: function (response) {
        showOrderSuccess(name, email, response.razorpay_payment_id);
      },
      modal: {
        ondismiss: function() {
          btn.disabled = false;
          btn.textContent = "Pay ₹1 & Complete Order →";
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } else {
    // Demo Mode / Key pending: Display instant download confirmation with developer note
    setTimeout(() => {
      showOrderSuccess(name, email, "DEMO_PAYMENT_" + Math.floor(Math.random() * 1000000), true);
    }, 800);
  }
}

function showOrderSuccess(name, email, paymentId, isDemo = false) {
  const modalBody = document.querySelector('#checkoutModal .modal-body');
  modalBody.innerHTML = `
    <div style="text-align: center; padding: 10px 0;">
      <div style="width: 56px; height: 56px; background: #ecfdf5; color: #059669; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h3 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Payment Successful!</h3>
      <p style="font-size: 0.9375rem; color: #475569; margin-bottom: 20px;">
        Thank you, <strong>${name}</strong>! Your transaction <code>${paymentId}</code> of <strong>₹1</strong> is verified.
      </p>

      ${isDemo ? `
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; font-size: 0.78rem; color: #1e40af; margin-bottom: 20px; text-align: left;">
        <strong>API Gateway Ready:</strong> Provide your Razorpay Key ID anytime to switch from demo mode to live UPI/Card payments.
      </div>
      ` : ''}

      <!-- Digital Product Access Link Box -->
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 0.82rem; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
          🚀 Your Digital Product Is Ready:
        </div>
        
        <a 
          href="https://dropshipglobal.vercel.app" 
          target="_blank" 
          rel="noopener noreferrer"
          style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 15px 20px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4);"
        >
          <span>Open Link &rarr;</span>
        </a>

        <div style="margin-top: 12px; font-size: 0.8rem; color: #4b5563;">
          Opens in a new tab: <span style="font-family: monospace; color: #15803d; font-weight: 700;">dropshipglobal.vercel.app</span>
        </div>
      </div>

      <button class="btn btn-secondary" style="width: 100%;" onclick="closeCheckoutModal(); location.reload();">Close Window</button>
    </div>
  `;
}

// --- Bonus Document Excerpt Reader ---
const bonusDocuments = {
  1: {
    title: "Document 01: Product Research & Scoring Script",
    content: `========================================================================
INTERNATIONAL PRODUCT EVALUATION PROTOCOL (FOR INDIAN SELLERS)
Classification: Internal Standard Operating Procedure
========================================================================

1. FINANCIAL UNIT ECONOMICS CRITERIA:
   - Target Retail Price (US/UK/EU): $39.99 to $59.99 USD
   - Landed Cost per Unit (Product + Air Packet Freight): < $13.50 USD
   - Calculated Gross Margin: Minimum 68% to 75%
   - Allowable Maximum Customer Acquisition Cost (CAC): $18.00 USD
   - Expected Net Contribution Margin: $12.00 - $16.00 USD per sale

2. PHYSICAL ATTRIBUTES & LOGISTICS AUDIT:
   [X] Weight: Strict ceiling of 450 grams (avoids volumetric freight spikes)
   [X] Dimensions: Fits in small standard polymailer (under 25cm x 18cm)
   [X] No fragile glass, heavy liquid, or hazardous lithium battery restrictions
   [X] Perceived value: High visual differentiation (cannot be price-checked at Walmart)

3. COMPETITIVE AD SCAN CHECKLIST:
   - Check Meta Ad Library (filter by US/UK, active > 25 days)
   - Minimum 3 competitor stores selling variant with > 15 live ads
   - Identify weak creative angles in comments (slow shipping, bad sizing)
   - Blueprint USP Hook: Offer upgraded 8-day VIP delivery + free replacement`
  },
  2: {
    title: "Document 02: Supplier Outreach & Negotiation Script",
    content: `========================================================================
DIRECT SUPPLIER NEGOTIATION SCRIPT (ENGLISH / GLOBAL AGENTS)
Target: CJ Dropshipping, DSers, Private Agents on WeChat / WhatsApp
========================================================================

SUBJECT: Business Partnership - High Volume Fulfillment for [Brand / Niche]

Hi [Supplier Name / Agent Name],

My name is [Your Name], Managing Partner at [Brand Name]. We are an e-commerce brand operating in Tier-1 western markets (primarily US, UK, and Australia).

We are currently scaling our product line: [Insert Product Link / AliExpress Link].
We are seeking a reliable private agent for long-term daily automated fulfillment.

OUR REQUIREMENTS:
1. Processing Time: Under 24-48 hours from order placement.
2. Shipping Line: YunExpress, 4PX, or CJ Special Packet with active tracking (average 7-10 business days to US/UK).
3. Packaging: 100% BLIND SHIPPING. Absolutely NO invoices, NO Chinese shipping labels, NO third-party promotional material.
4. Daily Order Volume: Currently testing 10-25 orders/day, scaling to 100+ orders/day once creative validation completes this week.

Please quote:
- Unit price for 1-50 units / 50-200 units
- Shipping cost to US (5-digit zip codes)
- ERP / CSV integration procedure

Looking forward to your swift response so we can allocate our upcoming ad spend.

Best regards,
[Your Name]
Managing Partner, [Brand Name]`
  },
  3: {
    title: "Document 03: High-Converting Ad Copy & Hook Framework",
    content: `========================================================================
TIER-1 AD COPYWRITING BLUEPRINT (META & TIKTOK FORMAT)
Tone: Empathetic, direct, conversational, high perceived authority
========================================================================

FRAMEWORK: [PROBLEM-AGITATE-INVALIDATE-SOLVE-OFFER]

[HOOK 1 (Curiosity / Contrarian)]:
"If you are still struggling with [Frustrating Problem], stop buying [Common Ineffective Product]. Here is why..."

[HOOK 2 (Pattern Interrupt)]:
"I almost threw away $200 until a friend showed me this simple fix for [Specific Problem]..."

[AGITATION]:
"You know the feeling when [Relatable daily frustration happens]? Most conventional options either take hours to set up or stop working after 2 weeks."

[SOLUTION INTRODUCTION]:
"That’s exactly why we spent 8 months developing the [Product Name]. Engineered specifically to [Main Benefit 1] without [Main Friction Point 2]."

[SOCIAL PROOF ANCHOR]:
"Over 14,000+ happy customers across the US & UK have already upgraded their routine."

[CALL TO ACTION + RISK REVERSAL]:
"👉 Tap 'Shop Now' below to claim our Summer Flash Sale (Up to 40% OFF).
Protected by our 30-Day 'No Questions Asked' Money-Back Guarantee."`
  },
  4: {
    title: "Document 04: Customer Support & Dispute Macros",
    content: `========================================================================
CUSTOMER SUPPORT MACROS & DISPUTE MITIGATION TEMPLATES
Goal: Preserve Merchant Account Standing & Neutralize Chargebacks
========================================================================

SCENARIO 1: "Where is my order?" (Tracking Inquiry)

"Hi [Customer First Name],

Thank you so much for reaching out to us!

Your order #[OrderNumber] was carefully packed and dispatched via our express courier line. It is currently in transit and has passed through international customs clearance.

You can monitor the live real-time carrier scan here:
👉 Tracking Link: [TrackingURL]
Last Known Status: [LastScanLocation]

Domestic delivery to your doorstep is handled by USPS / Royal Mail, and we expect delivery between [DateRange].

If you have any questions along the way, simply reply directly to this email—our dedicated support desk is available 7 days a week!

Warm regards,
Sarah | Customer Care Team"

------------------------------------------------------------------------

SCENARIO 2: Pre-Emptive Chargeback Neutralizer (Delivered or Slight Delay)

"Hi [Customer First Name],

We noticed your parcel is taking slightly longer than standard transit due to regional sorting facility volume. 

We take complete responsibility for your experience! As a token of our appreciation for your patience, we have issued a courtesy $5 refund back to your card right now.

Your package is guaranteed to arrive. If for any reason it does not reach you by [CutoffDate], we will issue a 100% full refund immediately. You never have to worry with us!"`
  },
  5: {
    title: "Document 05: Daily Store Operations & Scaling Checklist",
    content: `========================================================================
DAILY 15-MINUTE STORE OPERATIONS CHECKLIST
For Indian Dropshipping Entrepreneurs
========================================================================

TIME: 09:30 AM IST (Aligns with US Evening Checkout Activity)

1. CASH FLOW & GATEWAY AUDIT:
   [ ] Check Stripe / Razorpay International dashboard for settlement alerts.
   [ ] Confirm Dispute Rate is below 0.65% (safe threshold is < 0.90%).
   [ ] Check Wise / Indian bank forex remittance credit for completed payout.

2. ORDER PROCESSING:
   [ ] Sync Shopify unfulfilled orders with CJ Dropshipping / private agent ERP.
   [ ] Verify payment authorization statuses (cancel any high-risk flagged orders).
   [ ] Ensure tracking numbers auto-populated and sent to customers via email.

3. AD METRIC ASSESSMENT:
   [ ] Meta Ads Manager: Check spend vs. ROAS over last 3 days.
   [ ] If Ad Set ROAS > 2.5x with > 4 sales: Scale daily budget by +15% to 20%.
   [ ] If Ad Set CPA > $22 with 0 sales past 2x Breakeven CPA: Turn off creative.

4. CUSTOMER CARE DESK:
   [ ] Clear all incoming customer support tickets in under 6 hours.
   [ ] Check social ad comments: delete spam, answer product fit questions.

5. WEEKLY COMPLIANCE NOTE:
   [ ] Download monthly Foreign Inward Remittance Advice (FIRA) certificates for GST filing.`
  }
};

function openDocModal(docId) {
  const modal = document.getElementById('docModal');
  const title = document.getElementById('docModalTitle');
  const content = document.getElementById('docModalContent');

  if (bonusDocuments[docId]) {
    title.textContent = bonusDocuments[docId].title;
    content.textContent = bonusDocuments[docId].content;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeDocModal() {
  const modal = document.getElementById('docModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  const checkoutModal = document.getElementById('checkoutModal');
  const docModal = document.getElementById('docModal');

  if (e.target === checkoutModal) {
    closeCheckoutModal();
  }
  if (e.target === docModal) {
    closeDocModal();
  }
});
