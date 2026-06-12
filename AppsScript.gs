/**
 * 2026 HYFL Portfolio Gallery - Apps Script
 *
 * 사용법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드를 붙여넣기
 * 3. SHEET_ID 를 본인의 구글 시트 ID로 변경
 * 4. 필요하면 아래 COLUMN_MAP 의 헤더 이름을 시트의 실제 헤더와 맞게 수정
 * 5. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 6. 배포 후 생성된 웹 앱 URL을 script.js 의 APPS_SCRIPT_URL 에 붙여넣기
 */

// 구글 시트 ID (URL의 /d/ 와 /edit 사이 부분)
const SHEET_ID = "11PCEcOCjOpgvsirb6lBp1WyZflEafmvL1wyMBz3kl88";

// 시트의 헤더(열 이름)가 다를 경우 여기만 수정하면 됩니다.
// key: 결과 JSON 필드명, value: 시트의 헤더 텍스트
const COLUMN_MAP = {
  studentName: "이름",
  title: "",            // 이 시트에는 작품 제목 컬럼이 없음
  description: "",      // 이 시트에는 한 줄 소개 컬럼이 없음
  url: "웹사이트 주소",
};

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheets = ss.getSheets();
  const result = [];

  sheets.forEach(sheet => {
    const className = sheet.getName();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return; // 헤더만 있거나 빈 시트

    const headers = values[0].map(h => String(h).trim());
    const colIndex = {};
    Object.keys(COLUMN_MAP).forEach(key => {
      colIndex[key] = COLUMN_MAP[key] ? headers.indexOf(COLUMN_MAP[key]) : -1;
    });

    for (let i = 1; i < values.length; i++) {
      const row = values[i];

      const studentName = colIndex.studentName >= 0 ? String(row[colIndex.studentName] || "").trim() : "";
      const title = colIndex.title >= 0 ? String(row[colIndex.title] || "").trim() : "";
      const description = colIndex.description >= 0 ? String(row[colIndex.description] || "").trim() : "";
      const url = colIndex.url >= 0 ? String(row[colIndex.url] || "").trim() : "";

      // 이름이나 URL이 비어있는 행은 제외
      if (!studentName || !url) continue;

      result.push({
        className: className,
        studentName: studentName,
        title: title,
        description: description,
        url: url,
      });
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
