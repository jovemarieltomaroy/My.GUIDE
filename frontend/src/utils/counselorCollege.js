const colleges = {
  CCS: "College of Computer Studies",
  COET: "College of Engineering",
  COE: "College of Engineering",
  CSM: "College of Science and Mathematics",
  CED: "College of Education",
  CASS: "College of Arts and Social Sciences",
  CEBA: "College of Economics, Business and Accountancy",
  CBAA: "College of Economics, Business and Accountancy",
  CHS: "College of Health Sciences",
  CON: "College of Health Sciences",
};
export function handledCounselorColleges(user) {
  return [
    ...new Set(
      (user?.collegesHandled || [])
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => colleges[value.trim().toUpperCase()] || value.trim())
    ),
  ];
}
export function defaultCounselorCollege(user) {
  const handled = handledCounselorColleges(user);
  return handled.length === 1 ? handled[0] : "";
}
