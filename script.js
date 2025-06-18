document.getElementById("premiumForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const adults = parseInt(document.getElementById("adults").value);
  const children = parseInt(document.getElementById("children").value);
  const birthdate = document.getElementById("birthdate").value;
  const age = calculateAgeFromDOB(birthdate);

  const isFemaleProposer = document.getElementById("femaleProposer").checked;
  const isFemaleChild = document.getElementById("femaleChild").checked;

  const discount = (isFemaleProposer ? 5 : 0) + (isFemaleChild ? 5 : 0);

  const sheetName = getSheetName(adults, children);
  if (!sheetName) {
    alert("Invalid combination of adults and children.");
    return;
  }

  try {
    const baseData = await fetchJSON(`json_outputs/${sheetName}.json`);
    const baseNetPremiums = findNetPremium(baseData, age); // contains all SAs

    let totalPremium = { ...baseNetPremiums };

    if (children > 2) {
      const extraChildData = await fetchJSON("json_outputs/ExtraChild.json");
      const extraPremiums = calculateExtraChildPremium(extraChildData, children - 2);

      for (const key in totalPremium) {
        totalPremium[key] += extraPremiums[key];
      }
    }

    const grossTable = calculateGrossPremium(totalPremium, discount);
    renderResultTable(grossTable);

  } catch (error) {
    console.error("Error fetching or processing data:", error);
    alert("An error occurred while calculating the premium.");
  }
});

function calculateAgeFromDOB(dobString) {
  const today = new Date();
  const dob = new Date(dobString);
  let age = today.getFullYear() - dob.getFullYear();
  if (
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  ) {
    age--;
  }
  return age;
}

function getAgeGroup(age) {
  const groups = [
    [18, 20], [21, 35], [36, 45], [46, 50],
    [51, 55], [56, 60], [61, 65]
  ];

  for (const [start, end] of groups) {
    if (age >= start && age <= end) return `${start} to ${end}`;
  }

  return null;
}

function getSheetName(adults, children) {
  if (adults === 1 && children === 0) return "1A";
  if (adults === 2 && children === 0) return "2A";
  if (adults === 1 && children === 1) return "1A1C";
  if (adults === 1 && children >= 2) return "1A2C";
  if (adults === 2 && children === 1) return "2A1C";
  if (adults === 2 && children >= 2) return "2A2C";
  return null;
}

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}`);
  return await response.json();
}

function findNetPremium(data, age) {
  const ageGroup = getAgeGroup(age);
  if (!ageGroup) throw new Error("Invalid age group.");

  const row = data.find(row => row["Age Group"] === ageGroup);
  if (!row) throw new Error(`No premium found for age group: ${ageGroup}`);

  // Return full premiums for all SA levels
  const premiums = {};
  for (const key of ["5L", "10L", "15L", "20L", "25L"]) {
    premiums[key] = parseFloat(row[key]);
  }
  return premiums;
}

function calculateExtraChildPremium(data, extraChildren) {
  const row = data[0];
  if (!row) throw new Error("Invalid extra child premium data format.");

  const premiums = {};
  for (const key of ["5L", "10L", "15L", "20L", "25L"]) {
    if (!row[key]) throw new Error(`Missing value for ${key} in extra child premium.`);
    premiums[key] = extraChildren * parseFloat(row[key]);
  }

  return premiums;
}

function calculateGrossPremium(netPremiums, discount) {
  const rows = [];
  const sumAssuredOptions = [5, 10, 15, 20, 25]; // in lakhs

  const paymentTypes = [
    { label: "1 Year", multiplier: 1, extraDiscount: 0 },
    { label: "2 Year", multiplier: 2, extraDiscount: 20.95 },
    { label: "3 Year", multiplier: 3, extraDiscount: 25.20 },
  ];

  for (const type of paymentTypes) {
    const row = [type.label];

    for (const sumAssured of sumAssuredOptions) {
      const key = `${sumAssured}L`;
      let FN = netPremiums[key];

      // Step 1: Add loading if SA > 5L
      let FFN = FN + (sumAssured > 5 ? 0.12 * FN : 0);

      // Step 2: Apply female proposer/child discount (5% + 5%)
      let afterGenderDiscount = FFN - (FFN * discount / 100);

      // Step 3: Multiply for 2/3 year premium
      let multipliedPremium = afterGenderDiscount * type.multiplier;

      // Step 4: Apply multi-year discount
      let discountedPremium = multipliedPremium - (multipliedPremium * type.extraDiscount / 100);

      // Step 5: Add 18% GST
      let finalGross = discountedPremium + (discountedPremium * 0.18);

      row.push(`₹ ${Math.round(finalGross)}`);
    }

    rows.push(row);
  }

  return rows;
}

function renderResultTable(tableData) {
  const tbody = document.getElementById("premiumRows");
  tbody.innerHTML = "";
  tableData.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      td.className = "border px-2 py-1";
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  document.getElementById("resultTable").classList.remove("hidden");
}

     
