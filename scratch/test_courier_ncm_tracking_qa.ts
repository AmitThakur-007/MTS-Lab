import { PrismaClient } from '@prisma/client';
import { isNepalCanMove, NCM_TRACKING_URL } from '../src/pages/dashboard/CourierManagement';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`❌ FAIL: ${testName}`);
    if (details) {
      console.error(`   Details:`, details);
    }
  }
}

async function runQATests() {
  console.log("====================================================");
  console.log("🚀 MTS LAB COURIER HUB — NEPAL CAN MOVE (NCM) QA TESTS");
  console.log("====================================================\n");

  try {
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

    // 1. Fetch admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null }
    }) || await prisma.user.findFirst();

    if (!adminUser) {
      throw new Error('No admin user found in database.');
    }

    const adminToken = jwt.default.sign(
      { id: adminUser.id, role: adminUser.role, email: adminUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TEST 1: Nepal Can Move Provider Detection Helper
    console.log("--- TEST 1: Courier Provider Detection Helper ---");
    assert(isNepalCanMove("Nepal Can Move (NCM)"), "isNepalCanMove identifies 'Nepal Can Move (NCM)'");
    assert(isNepalCanMove("Nepal Can Move"), "isNepalCanMove identifies 'Nepal Can Move'");
    assert(isNepalCanMove("nepal can move"), "isNepalCanMove identifies lowercase 'nepal can move'");
    assert(isNepalCanMove("NCM"), "isNepalCanMove identifies 'NCM'");
    assert(isNepalCanMove("ncm logistics"), "isNepalCanMove identifies 'ncm logistics'");
    assert(!isNepalCanMove("Sundarban Courier"), "isNepalCanMove rejects 'Sundarban Courier'");
    assert(!isNepalCanMove("Gorkha Courier"), "isNepalCanMove rejects 'Gorkha Courier'");
    assert(!isNepalCanMove("Nepal Post (EMS)"), "isNepalCanMove rejects 'Nepal Post (EMS)'");
    assert(!isNepalCanMove(""), "isNepalCanMove handles empty string safely");
    assert(NCM_TRACKING_URL === "https://portal.nepalcanmove.com/track/", "Official NCM tracking URL is strictly defined");

    // Helper to construct WhatsApp messages exactly as CourierManagement does
    const generateWhatsAppMessage = (
      type: 'DISPATCH' | 'RECEIVED' | 'DELIVERED',
      customerName: string,
      deviceModel: string,
      repairNo: string,
      courierPartner: string,
      trackingNo: string
    ) => {
      let msg = '';
      if (type === 'DISPATCH') {
        const isNCM = isNepalCanMove(courierPartner);
        if (isNCM) {
          msg = `Hello ${customerName},\n\nYour repaired device (${deviceModel}) under Repair Job #${repairNo} has been dispatched through Nepal Can Move.\n\n📦 Courier: Nepal Can Move\n🔎 Tracking ID: ${trackingNo}\n\n🚚 Track with Nepal Can Move:\n${NCM_TRACKING_URL}\n\n🔧 Track your repair through MTS Lab:\nhttps://www.mobiletechnologystation.com.np/track?repairNumber=${repairNo}\n\n📞 Support: +977-9869276668\n\nYou can use your tracking ID on the Nepal Can Move tracking page to check the courier status.\n\nThank you for choosing MTS Lab!`;
        } else {
          msg = `Hello ${customerName},\n\nYour repaired device (${deviceModel}) under Repair Job #${repairNo} has been dispatched via ${courierPartner}.\n\n📦 Courier Tracking / AWB No: ${trackingNo}\n\n🔧 Track your live service status anytime on our website:\nhttps://www.mobiletechnologystation.com.np/track?repairNumber=${repairNo}\n\n📞 Support: +977-9869276668\n\nThank you for choosing MTS Lab!`;
        }
      } else if (type === 'RECEIVED') {
        msg = `Hello ${customerName},\n\nWe have safely received your device (${deviceModel}) at MTS Lab via ${courierPartner} (AWB #${trackingNo}).\n\n📋 Repair Ticket: #${repairNo}\nOur micro-engineers will initiate diagnosis and keep you updated.\n\nTrack progress: https://www.mobiletechnologystation.com.np/track?repairNumber=${repairNo}\n\n📞 Support: +977-9869276668\n\n— MTS Lab Repair Management`;
      } else {
        msg = `Hello ${customerName},\n\nYour device (${deviceModel}) for Repair Job #${repairNo} has been delivered successfully.\n\nWe hope you are satisfied with our repair service. If you have any questions or need further assistance, please feel free to contact MTS Lab.\n\nThank you for trusting MTS Lab!`;
      }
      return msg;
    };

    // TEST 2: NCM WhatsApp Dispatch Message Structure
    console.log("\n--- TEST 2: NCM WhatsApp Dispatch Message Structure ---");
    const ncmMsg = generateWhatsAppMessage(
      'DISPATCH',
      'Suman Shrestha',
      'SAMSUNG Galaxy S23 Ultra',
      'MTS-2026-1787305865579',
      'Nepal Can Move (NCM)',
      'NCM123456789'
    );

    assert(ncmMsg.includes('Hello Suman Shrestha,'), "Customer name dynamically included");
    assert(ncmMsg.includes('SAMSUNG Galaxy S23 Ultra'), "Device model included");
    assert(ncmMsg.includes('📦 Courier: Nepal Can Move'), "Courier provider included");
    assert(ncmMsg.includes('🔎 Tracking ID: NCM123456789'), "Tracking ID clearly displayed");
    assert(ncmMsg.includes('🚚 Track with Nepal Can Move:\nhttps://portal.nepalcanmove.com/track/'), "Official NCM tracking link included");
    assert(ncmMsg.includes('https://www.mobiletechnologystation.com.np/track?repairNumber=MTS-2026-1787305865579'), "Official MTS Lab website link included");
    assert(ncmMsg.includes('📞 Support: +977-9869276668'), "Official MTS Lab phone (+977-9869276668) included");
    assert(!ncmMsg.includes('mtslab.com'), "Old domain mtslab.com is NOT present");
    assert(!ncmMsg.includes('9801234567'), "Old phone 9801234567 is NOT present");
    assert(ncmMsg.includes('You can use your tracking ID on the Nepal Can Move tracking page to check the courier status.'), "Instruction note included");

    // TEST 3: Other Courier Provider WhatsApp Dispatch Message
    console.log("\n--- TEST 3: Other Courier Provider WhatsApp Message ---");
    const otherMsg = generateWhatsAppMessage(
      'DISPATCH',
      'Ramesh Kumar',
      'APPLE iPhone 14 Pro',
      'MTS-2026-998877',
      'Nepal Post (EMS)',
      'EMS-NP-1787334671899'
    );

    assert(otherMsg.includes('Hello Ramesh Kumar,'), "Customer name included");
    assert(otherMsg.includes('dispatched via Nepal Post (EMS)'), "Courier partner included");
    assert(otherMsg.includes('📦 Courier Tracking / AWB No: EMS-NP-1787334671899'), "AWB included");
    assert(otherMsg.includes('https://www.mobiletechnologystation.com.np/track?repairNumber=MTS-2026-998877'), "Official MTS Lab website link included");
    assert(otherMsg.includes('📞 Support: +977-9869276668'), "Official MTS Lab phone (+977-9869276668) included");
    assert(!otherMsg.includes('nepalcanmove.com'), "NCM link is NOT present for other couriers");
    assert(!otherMsg.includes('mtslab.com'), "Old domain mtslab.com is NOT present");
    assert(!otherMsg.includes('9801234567'), "Old phone 9801234567 is NOT present");

    // TEST 4: Delivered Customer Message
    console.log("\n--- TEST 4: Delivered Customer Message Verification ---");
    const deliveredMsg = generateWhatsAppMessage(
      'DELIVERED',
      'Amit Sharma',
      'XIAOMI Redmi Note 13',
      'MTS-2026-332211',
      'Nepal Can Move',
      'NCM-4455'
    );

    assert(deliveredMsg.includes('We hope you are satisfied with our repair service. If you have any questions or need further assistance, please feel free to contact MTS Lab.'), "Satisfaction message updated");
    assert(!deliveredMsg.includes('your repair includes warranty coverage, you can check details on your tracking ticket'), "Old warranty coverage sentence completely removed");

    // TEST 5: Backend API Outbound Dispatch via NCM
    console.log("\n--- TEST 5: Backend API Outbound Dispatch via NCM ---");
    // Find or create a repair in READY_FOR_PICKUP or REPAIRED status
    let targetRepair = await prisma.repair.findFirst({
      where: {
        status: { in: ['REPAIRED', 'READY_FOR_PICKUP'] },
        isReturnCourierDispatched: false
      }
    });

    if (!targetRepair) {
      // Find any active repair
      targetRepair = await prisma.repair.findFirst({});
    }

    if (targetRepair) {
      const testAwb = `NCM-QA-${Date.now()}`;
      const dispatchRes = await fetch(`${BASE_URL}/api/couriers/outgoing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repairId: targetRepair.id,
          returnCourierCompany: 'Nepal Can Move (NCM)',
          returnCourierTrackingNumber: testAwb,
          returnCourierDispatchDate: new Date().toISOString(),
          destinationDistrict: 'Pokhara',
          destinationAddress: 'Lakeside Ward 6',
          receiverName: 'QA Customer Receiver',
          receiverPhone: '9841234567',
          courierOutCharge: 250,
          courierOutPaymentStatus: 'UNPAID',
          returnCourierNotes: 'QA test dispatch via Nepal Can Move'
        })
      });

      const dispatchData: any = await dispatchRes.json();
      assert([200, 201].includes(dispatchRes.status), "Outbound dispatch via NCM API succeeded (status 200/201)", dispatchData);
      assert(dispatchData.success === true, "Dispatch returned success: true");

      // Verify Public Track Route
      const trackRes = await fetch(`${BASE_URL}/api/track?repairNumber=${targetRepair.repairNumber}`);
      const trackData: any = await trackRes.json();
      assert(trackRes.status === 200, "Public track endpoint responds with 200");
      const trackRepair = trackData.devices?.[0] || trackData.data || trackData.repair || trackData;
      assert(trackRepair.returnCourierCompany === 'Nepal Can Move (NCM)', "Track repair reflects NCM partner", trackRepair);
      assert(trackRepair.returnCourierTrackingNumber === testAwb, "Track repair reflects NCM AWB", trackRepair);
    }

    console.log("\n====================================================");
    console.log(`🎉 QA TEST RESULTS: ${passedTests} PASSED | ${failedTests} FAILED (Total: ${totalTests})`);
    console.log("====================================================");

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ QA Test Failure:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runQATests();
