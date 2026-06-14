/* ============================================================
   Firebase 설정
   ============================================================
   1. https://console.firebase.google.com 에서 프로젝트를 생성하세요.
   2. 프로젝트 설정 > 일반 > "내 앱"에서 웹 앱을 추가하면
      아래와 같은 형태의 설정 객체를 받을 수 있습니다. 그 값을 그대로
      아래 firebaseConfig 에 붙여넣어 주세요.
   3. Firestore Database 를 생성하고(테스트 모드 또는 아래 규칙 참고),
      이 프로젝트는 별도 백엔드 서버 없이 정적 페이지에서
      Firestore에 바로 읽고 씁니다.

   Firestore 보안 규칙 예시 (조회수/응원/방명록 용도에 맞게 단순화):

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /works/{workId} {
         allow read: if true;
         allow write: if request.resource.data.keys().hasOnly(['views', 'cheers'])
           && request.resource.data.views is int
           && request.resource.data.cheers is int;
       }
       match /guestbook/{entryId} {
         allow read: if true;
         allow create: if request.resource.data.name is string
           && request.resource.data.name.size() <= 20
           && request.resource.data.message is string
           && request.resource.data.message.size() <= 120;
         allow update, delete: if false;
       }
       match /meta/{docId} {
         allow read: if true;
         allow write: if request.resource.data.keys().hasOnly(['totalViews', 'totalCheers', 'totalGuestbook'])
       }
     }
   }
   ============================================================ */

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
