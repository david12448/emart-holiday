/*
==================================================
기본 설정
==================================================
*/

const MART_CONFIG =
  window.MART_CONFIG || {};


/*
보호 배포 시 build workflow가
실제 redirect gateway 주소를 이 값에 주입합니다.
일반 개발/기존 배포에서는 빈 문자열을 유지합니다.
*/
const BUILD_OFFICIAL_STORE_REDIRECT_BASE = 'https://mart-store-link-gateway.mart-holiday-david12448.workers.dev/r';


const TISTORY_POST_URL =
  "javascript:void(0)";


const DETAIL_BASE_URL =
  MART_CONFIG.detailBaseUrl || "";


const regionOrder = [
  "서울",
  "인천",
  "경기",
  "대전",
  "세종",
  "충청",
  "대구",
  "경상",
  "울산",
  "부산",
  "전라",
  "광주",
  "강원",
  "제주"
];


const weekdayNames = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일"
];


let holidayData = [];


/*
자동 수집기가 만든
data/<brand>/change_status.json 내용
*/
let changeStatusData = null;


/*
주소 파라미터
예:
?region=대구
?storeId=1118
*/
const urlParams =
  new URLSearchParams(
    window.location.search
  );


const requestedRegion =
  urlParams.get("region");


/*
브랜드별 선택 옵션으로 제공하는
특수 매장 유형 탭입니다.

설정이 없는 브랜드에는
두 번째 탭 줄이 나타나지 않습니다.
*/
const specialStoreTabs =
  Array.isArray(
    MART_CONFIG.specialStoreTabs
  )
    ? MART_CONFIG.specialStoreTabs
        .map(
          item => ({
            type:
              String(
                item?.type || ""
              ).trim(),

            label:
              String(
                item?.label || ""
              ).trim()
          })
        )
        .filter(
          item =>
            item.type &&
            item.label
        )
    : [];


const requestedSpecialType =
  urlParams.get("type");


let selectedSpecialType =
  specialStoreTabs.some(
    item =>
      item.type ===
      requestedSpecialType
  )
    ? requestedSpecialType
    : null;


/*
?region=all
또는
?region=전체

→ 지역 탭을 숨기고 전국 점포를 한 화면에 표시
*/
const isAllRegions =
  requestedRegion === "all" ||
  requestedRegion === "전체";


let requestedStoreId =
  urlParams.get("storeId");


let selectedRegion =
  selectedSpecialType
    ? "all"
    : (
        (
          requestedRegion === "all"
          ||
          requestedRegion === "전체"
        )
          ? "all"
          : (
              regionOrder.includes(
                requestedRegion
              )
                ? requestedRegion
                : "서울"
            )
      );

/*
date=YYYY-MM 파라미터

예:
?date=2026-10
*/
const requestedDate =
  urlParams.get("date");


function parseRequestedMonth(
  value
) {

  if (
    typeof value !== "string"
  ) {
    return null;
  }


  const match =
    value.match(
      /^(\d{4})-(0[1-9]|1[0-2])$/
    );


  if (!match) {
    return null;
  }


  return {
    year:
      Number(match[1]),

    month:
      Number(match[2])
  };

}


const requestedMonth =
  parseRequestedMonth(
    requestedDate
  );


/*
한국 날짜 기준
*/
function getKoreaTodayDate() {

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(
      new Date()
    );


  const values = {};

  parts.forEach(
    part => {

      if (
        part.type === "year" ||
        part.type === "month" ||
        part.type === "day"
      ) {

        values[part.type] =
          Number(part.value);

      }

    }
  );


  return new Date(
    values.year,
    values.month - 1,
    values.day
  );

}


const koreaToday =
  getKoreaTodayDate();


let selectedYear =
  requestedMonth
    ? requestedMonth.year
    : koreaToday.getFullYear();


let selectedMonth =
  requestedMonth
    ? requestedMonth.month
    : koreaToday.getMonth() + 1;


/*
==================================================
공통 함수
==================================================
*/

function pad2(number) {

  return String(number)
    .padStart(2, "0");

}


function dateToKey(date) {

  return (
    `${date.getFullYear()}-` +
    `${pad2(date.getMonth() + 1)}-` +
    `${pad2(date.getDate())}`
  );

}


function getSelectedMonthKey() {

  return (
    `${selectedYear}-` +
    `${pad2(selectedMonth)}`
  );

}

/*
현재 선택한 월을 URL의 date= 에 반영
기존 region, storeId 등의 파라미터는 유지합니다.
*/
function updateDateInUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  params.set(
    "date",
    getSelectedMonthKey()
  );


  const newUrl =
    window.location.pathname +
    "?" +
    params.toString() +
    window.location.hash;


  window.history.replaceState(
    null,
    "",
    newUrl
  );

}


/*
지역 탭을 선택했을 때
region + 현재 date를 URL에 함께 반영
*/
function updateRegionInUrl(
  region
) {

  const params =
    new URLSearchParams(
      window.location.search
    );


  params.set(
    "region",
    region
  );


  params.set(
    "date",
    getSelectedMonthKey()
  );


  params.delete(
    "storeId"
  );


  params.delete(
    "type"
  );


  selectedSpecialType =
    null;


  requestedStoreId =
    null;


  const newUrl =
    window.location.pathname +
    "?" +
    params.toString() +
    window.location.hash;


  window.history.replaceState(
    null,
    "",
    newUrl
  );

}


/*
특수 매장 탭 선택 시
전국 + 매장 유형을 URL에 함께 반영합니다.
*/
function updateSpecialTypeInUrl(
  type
) {

  const params =
    new URLSearchParams(
      window.location.search
    );


  params.set(
    "region",
    "all"
  );


  params.set(
    "type",
    type
  );


  params.set(
    "date",
    getSelectedMonthKey()
  );


  params.delete(
    "storeId"
  );


  requestedStoreId =
    null;


  const newUrl =
    window.location.pathname +
    "?" +
    params.toString() +
    window.location.hash;


  window.history.replaceState(
    null,
    "",
    newUrl
  );

}


/*
==================================================
점포 데이터 공통 형식 변환
==================================================
*/

function getStoreId(store) {

  return String(
    store?.sid ??
    store?.storeId ??
    store?.id ??
    ""
  );

}


function getStoreType(store) {

  return String(
    store?.storeType ||
    "standard"
  ).trim();

}


function normalizeRegionName(value) {

  const region =
    String(value || "").trim();

  const regionMap = {
    "서울특별시": "서울",
    "부산광역시": "부산",
    "부산시": "부산",
    "대구광역시": "대구",
    "인천광역시": "인천",
    "광주광역시": "광주",
    "대전광역시": "대전",
    "울산광역시": "울산",
    "세종특별자치시": "세종",

    "경기도": "경기",

    "강원도": "강원",
    "강원특별자치도": "강원",

    "충청북도": "충청",
    "충청남도": "충청",

    "전라북도": "전라",
    "전북특별자치도": "전라",
    "전라남도": "전라",

    "경상북도": "경상",
    "경상남도": "경상",

    "제주특별자치도": "제주"
  };

  return (
    regionMap[region] ||
    region
  );

}


function getStoreRegion(store) {

  return normalizeRegionName(
    store?.sido ??
    store?.region ??
    ""
  );

}


function getStoreDetailUrl(store) {

  const directUrl =
    String(
      store?.detailUrl ??
      store?.detail_url ??
      ""
    ).trim();


  if (directUrl) {

    return directUrl;

  }


  const redirectBase =
    String(
      MART_CONFIG.officialStoreRedirectBase ??
      BUILD_OFFICIAL_STORE_REDIRECT_BASE ??
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );


  const redirectKey =
    String(
      store?.redirectKey ??
      store?.sid ??
      ""
    ).trim();


  if (
    redirectBase
    &&
    redirectKey
  ) {

    return (
      redirectBase
      +
      "/"
      +
      encodeURIComponent(
        redirectKey
      )
    );

  }


  return "";

}

function getStorePhone(store) {

  return String(
    store?.phone ??
    store?.telephone ??
    ""
  ).trim();

}


function getStoreTelHref(store) {

  const phone =
    getStorePhone(
      store
    );

  if (!phone) {
    return "";
  }

  const telNumber =
    phone.replace(
      /[^0-9+]/g,
      ""
    );

  return (
    telNumber
      ? `tel:${telNumber}`
      : ""
  );

}


function getStoreAddress(store) {

  return String(
    store?.address ??
    ""
  ).trim();

}


function buildStoreBasicInfo(
  store
) {

  const address =
    getStoreAddress(
      store
    );

  const phone =
    getStorePhone(
      store
    );

  const telHref =
    getStoreTelHref(
      store
    );

  if (
    !address &&
    !phone
  ) {

    return "";

  }

  return `
    <div class="store-basic-info">
      ${address
        ? `
          <div class="store-basic-info-row">
            <span class="store-basic-info-label">
              주소
            </span>
            <span class="store-basic-info-value">
              ${address}
            </span>
          </div>
        `
        : ""
      }

      ${phone
        ? `
          <div class="store-basic-info-row">
            <span class="store-basic-info-label">
              전화
            </span>
            ${telHref
              ? `
                <a
                  class="store-basic-info-phone"
                  href="${telHref}"
                  aria-label="${phone} 전화 연결"
                >
                  ${phone}
                </a>
              `
              : `
                <span class="store-basic-info-value">
                  ${phone}
                </span>
              `
            }
          </div>
        `
        : ""
      }
    </div>
  `;

}



function shortStoreName(name) {

  const prefix =
    MART_CONFIG.storePrefix || "";

  if (
    prefix &&
    name.startsWith(prefix)
  ) {

    return name.slice(
      prefix.length
    );

  }

  return name;

}


function formatStoreDisplayName(
  store
) {

  const rawDisplayName =
    shortStoreName(
      store.store
    );

  const storeType =
    String(
      store?.storeType || "standard"
    ).trim();

  const brandBadgeLabel =
    String(
      MART_CONFIG.storeBrandBadgeLabel || ""
    ).trim();

  if (
    MART_CONFIG.showBrandBadge === true
    &&
    brandBadgeLabel
  ) {

    return `
      <span class="
        store-special-name
        store-special-name-brand
      ">
        <span class="
          store-special-base
        ">
          ${rawDisplayName}
        </span>
        <span class="
          store-type-text
          store-type-text-brand
        ">
          ${brandBadgeLabel}
        </span>
      </span>
    `;

  }

  if (
    MART_CONFIG.showStoreTypeBadges !== true
  ) {

    return rawDisplayName;

  }

  if (
    storeType === "foodmarket"
  ) {

    const baseName =
      rawDisplayName
        .replace(
          /^푸드마켓\s*/,
          ""
        )
        .trim();

    return `
      <span class="
        store-special-name
        store-special-name-foodmarket
      ">
        <span class="
          store-special-base
        ">
          ${baseName}
        </span>
        <span class="
          store-type-text
          store-type-text-foodmarket
        ">
          푸드마켓
        </span>
      </span>
    `;

  }

  if (
    storeType === "starfieldmarket"
  ) {

    const baseName =
      rawDisplayName
        .replace(
          /^스타필드\s*마켓\s*/,
          ""
        )
        .replace(
          /^스타필드마켓\s*/,
          ""
        )
        .trim();

    return `
      <span class="
        store-special-name
        store-special-name-starfieldmarket
      ">
        <span class="
          store-special-base
        ">
          ${baseName}
        </span>
        <span class="
          store-type-text
          store-type-text-starfieldmarket
        ">
          스타필드
        </span>
      </span>
    `;

  }


  if (
    storeType === "traders"
  ) {

    const baseName =
      rawDisplayName
        .replace(
          /^트레이더스\s*홀세일\s*클럽\s*/,
          ""
        )
        .replace(
          /^트레이더스\s*/,
          ""
        )
        .trim();

    return `
      <span class="
        store-special-name
        store-special-name-traders
      ">
        <span class="
          store-special-base
        ">
          ${baseName}
        </span>
        <span class="
          store-type-text
          store-type-text-traders
        ">
          트레이더스
        </span>
      </span>
    `;

  }

  return rawDisplayName;

}


function getWeekday(dateString) {

  const parts =
    dateString.split("-");


  const date =
    new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );


  return weekdayNames[
    date.getDay()
  ];

}


function formatDate(dateString) {

  const parts =
    dateString.split("-");


  const month =
    Number(parts[1]);


  const day =
    Number(parts[2]);


  const weekday =
    getWeekday(dateString);


  return (
    `${month}월 ${day}일` +
    `(${weekday.charAt(0)})`
  );

}


/*
선택한 달의 휴무일만 반환
*/
function getMonthHolidays(store) {

  const prefix =
    getSelectedMonthKey() + "-";


  return (
    Array.isArray(store.holidays)
      ? store.holidays.filter(
          date =>
            date.startsWith(prefix)
        )
      : []
  );

}


/*
선택한 달에 휴무가 있는 점포만 생성
기존 점포 객체는 건드리지 않습니다.
*/
function getMonthStores(stores) {

  return stores
    .map(
      store => ({
        ...store,
        holidays:
          getMonthHolidays(store)
      })
    )
    .filter(
      store =>
        store.holidays.length > 0
    );

}


/*
holiday_archive.json에 존재하는
가장 이른 달 / 가장 늦은 달
*/
function getAvailableMonthRange() {

  const months = [];


  holidayData.forEach(
    store => {

      (store.holidays || [])
        .forEach(
          date => {

            if (
              typeof date === "string" &&
              date.length >= 7
            ) {

              months.push(
                date.slice(0, 7)
              );

            }

          }
        );

    }
  );


  const uniqueMonths =
    [...new Set(months)]
      .sort();


  if (
    uniqueMonths.length === 0
  ) {

    const currentKey =
      `${koreaToday.getFullYear()}-` +
      `${pad2(koreaToday.getMonth() + 1)}`;

    return {
      min: currentKey,
      max: currentKey
    };

  }


  return {
    min: uniqueMonths[0],
    max:
      uniqueMonths[
        uniqueMonths.length - 1
      ]
  };

}


/*
URL로 요청한 월이
보관 데이터 범위를 벗어난 경우
가장 가까운 사용 가능한 월로 조정
*/
function normalizeSelectedMonthRange() {

  const range =
    getAvailableMonthRange();


  let monthKey =
    getSelectedMonthKey();


  if (
    monthKey < range.min
  ) {

    monthKey =
      range.min;

  } else if (
    monthKey > range.max
  ) {

    monthKey =
      range.max;

  } else {

    return;

  }


  const parts =
    monthKey.split("-");


  selectedYear =
    Number(parts[0]);


  selectedMonth =
    Number(parts[1]);

}


function getShiftedMonth(step) {

  const date =
    new Date(
      selectedYear,
      selectedMonth - 1 + step,
      1
    );


  return {
    year:
      date.getFullYear(),

    month:
      date.getMonth() + 1,

    key:
      `${date.getFullYear()}-` +
      `${pad2(date.getMonth() + 1)}`
  };

}


function canMoveMonth(step) {

  const range =
    getAvailableMonthRange();


  const target =
    getShiftedMonth(step);


  return (
    target.key >= range.min &&
    target.key <= range.max
  );

}


function moveMonth(step) {

  if (
    !canMoveMonth(step)
  ) {

    return;

  }


  const target =
    getShiftedMonth(step);


  selectedYear =
    target.year;


  selectedMonth =
    target.month;


  /*
  변경된 월을 URL에도 반영
  */
  updateDateInUrl();


  renderCurrentView();

}



/*
==================================================
달력 안에 표시할 간단 요약
==================================================
*/

function buildCalendarQuickSummary(
  holidayCount,
  stores
) {

  const dates =
    Object.keys(
      holidayCount
    ).sort();


  if (
    dates.length === 0
  ) {

    return `
      <div class="calendar-quick-summary">

        <span class="calendar-summary-label">
          ${selectedMonth}월 휴무
        </span>

        <span>
          등록된 휴무일이 없습니다.
        </span>

      </div>
    `;

  }


  const weekdayNames = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토"
  ];


  /*
  같은 요일끼리 날짜를 묶습니다.
  */
  const weekdayGroups = {};


  dates.forEach(
    date => {

      const [
        year,
        month,
        day
      ] =
        String(
          date
        )
          .split("-")
          .map(
            Number
          );


      const weekday =
        new Date(
          year,
          month - 1,
          day
        ).getDay();


      if (
        !weekdayGroups[
          weekday
        ]
      ) {

        weekdayGroups[
          weekday
        ] = [];

      }


      weekdayGroups[
        weekday
      ].push({
        date,
        year,
        month,
        day,
        weekday
      });

    }
  );


  const singleGroups = [];
  const multipleGroups = [];


  Object.values(
    weekdayGroups
  ).forEach(
    group => {

      group.sort(
        (a, b) =>
          a.day - b.day
      );


      if (
        group.length === 1
      ) {

        singleGroups.push(
          group
        );

      } else {

        multipleGroups.push(
          group
        );

      }

    }
  );


  /*
  한 번만 있는 날짜는
  날짜순으로 먼저 표시합니다.
  */
  singleGroups.sort(
    (a, b) =>
      a[0].day -
      b[0].day
  );


  /*
  반복 휴무는
  일 → 수 → 월 → 토 순으로 표시합니다.
  */
  const weekdayPriority = [
    0,
    3,
    1,
    6,
    2,
    4,
    5
  ];


  multipleGroups.sort(
    (a, b) => {

      return (
        weekdayPriority.indexOf(
          a[0].weekday
        )
        -
        weekdayPriority.indexOf(
          b[0].weekday
        )
      );

    }
  );


  const groups = [
    ...singleGroups,
    ...multipleGroups
  ];


  const summary =
    groups
      .map(
        group => {

          const first =
            group[0];


          const weekdayName =
            weekdayNames[
              first.weekday
            ];


          if (
            group.length === 1
          ) {

            return `
              <span class="calendar-summary-date-group">
                ${first.day}일(${weekdayName})
              </span>
            `;

          }


          const days =
            group
              .map(
                item =>
                  `${item.day}일`
              )
              .join("·");


          return `
            <span class="calendar-summary-date-group">
              ${days}(${weekdayName})
            </span>
          `;

        }
      )
      .join("");


  return `
    <div class="calendar-quick-summary">

      <span class="calendar-summary-label">
        ${selectedMonth}월 휴무
      </span>

      <span class="calendar-summary-dates">
        ${summary}
      </span>

    </div>
  `;

}




/*
==================================================
휴무 일정 변경 안내
==================================================
*/

function getChangeStatusUrl() {

  if (
    MART_CONFIG.changeStatusUrl
  ) {

    return (
      MART_CONFIG.changeStatusUrl
    );

  }


  /*
  별도 설정이 없어도
  holidays.json과 같은 폴더의
  change_status.json을 자동 사용합니다.

  예:
  data/emart/holidays.json
  →
  data/emart/change_status.json
  */
  return String(
    MART_CONFIG.currentDataUrl || ""
  ).replace(
    /holidays\.json$/,
    "change_status.json"
  );

}


function formatCheckedAt(
  isoString
) {

  if (!isoString) {
    return "";
  }


  const date =
    new Date(
      isoString
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return (
    `${date.getFullYear()}년 ` +
    `${date.getMonth() + 1}월 ` +
    `${date.getDate()}일 ` +
    `${pad2(date.getHours())}:` +
    `${pad2(date.getMinutes())}`
  );

}

/*
==================================================
데이터 출처 / 최근 확인 / 최근 정보 변경 표시
==================================================
*/

function formatDataDate(
  isoString
) {

  if (!isoString) {
    return "";
  }


  const date =
    new Date(
      isoString
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  const parts =
    new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(
      date
    );


  const values = {};

  parts.forEach(
    part => {

      if (
        part.type === "year" ||
        part.type === "month" ||
        part.type === "day"
      ) {

        values[part.type] =
          part.value;

      }

    }
  );


  return (
    `${values.year}.` +
    `${values.month}.` +
    `${values.day}`
  );

}


function getLastCheckedAt() {

  if (!changeStatusData) {
    return "";
  }


  return (
    changeStatusData.checkedAt ||
    changeStatusData.checked_at ||
    ""
  );

}


function getLastInformationChangedAt() {

  /*
  change_status.json에
  별도 변경 시각이 있으면 우선 사용
  */
  if (changeStatusData) {

    const statusChangedAt =
      changeStatusData.lastChangeAt ||
      changeStatusData.last_change_at ||
      "";

    if (statusChangedAt) {
      return statusChangedAt;
    }

  }


  /*
  없으면 각 점포의 updatedAt 중
  가장 최근 시각을 사용
  */
  const timestamps =
    holidayData
      .map(
        store =>
          store.updatedAt ||
          store.updated_at ||
          ""
      )
      .filter(Boolean)
      .sort();


  if (
    timestamps.length === 0
  ) {

    return "";

  }


  return timestamps[
    timestamps.length - 1
  ];

}


function updateSourceStatus() {

  const source =
    document.getElementById(
      "source-label"
    );


  if (!source) {
    return;
  }


  const sourceText =
    MART_CONFIG.sourceLabel ||
    "공식 홈페이지";


  const checkedAt =
    formatDataDate(
      getLastCheckedAt()
    );


  const changedAt =
    formatDataDate(
      getLastInformationChangedAt()
    );


  let text =
    `자료 출처 : ${sourceText}`;


  if (checkedAt) {

    text +=
      ` · 최근 확인 : ${checkedAt}`;

  }


  if (changedAt) {

    text +=
      ` · 최근 정보 변경 : ${changedAt}`;

  }


  source.textContent =
    text;

}

function isChangeNoticeActive() {

  if (!changeStatusData) {
    return false;
  }

  const noticeUntil =
    changeStatusData.noticeUntil ||
    changeStatusData.notice_until ||
    "";

  /*
  Python workflow가 월·목만 실행되더라도
  브라우저에서 정확히 7일이 지나면
  알림을 자동으로 숨깁니다.
  */
  if (noticeUntil) {

    const untilDate =
      new Date(
        noticeUntil
      );

    if (
      !Number.isNaN(
        untilDate.getTime()
      )
      &&
      Date.now() >=
      untilDate.getTime()
    ) {

      return false;
    }
  }

  if (
    typeof changeStatusData.notice_active ===
    "boolean"
  ) {

    return changeStatusData.notice_active;
  }

  return Boolean(
    changeStatusData.changed
  );
}


function getChangeNoticeDate() {

  if (!changeStatusData) {
    return "";
  }


  return (
    changeStatusData.lastChangeAt ||
    changeStatusData.last_change_at ||
    changeStatusData.checkedAt ||
    changeStatusData.checked_at ||
    ""
  );

}


function getChangeHolidayDates(change) {

  if (!change) {
    return [];
  }


  /*
  이마트 형식
  */
  if (
    Array.isArray(
      change.added_holidays
    ) ||
    Array.isArray(
      change.removed_holidays
    )
  ) {

    return [
      ...(
        change.added_holidays ||
        []
      ),
      ...(
        change.removed_holidays ||
        []
      )
    ];

  }


  /*
  롯데 형식
  */
if (
  change.field === "holidays"
) {

  const before =
    Array.isArray(change.before)
      ? change.before
      : [];


  const after =
    Array.isArray(change.after)
      ? change.after
      : [];


  const removed =
    before.filter(
      date =>
        !after.includes(date)
    );


  const added =
    after.filter(
      date =>
        !before.includes(date)
    );


  return [
    ...removed,
    ...added
  ];

}


  return [];

}

function normalizeStoreName(value) {

  return String(
    value || ""
  )
    .replace(/\s+/g, "")
    .trim();

}


function changeMatchesStore(
  change,
  store
) {

  if (
    !change ||
    !store
  ) {

    return false;

  }


/*
공통 storeId 형식
*/
if (
  change.storeId !== undefined &&
  change.storeId !== null &&
  String(change.storeId).trim()
) {

  return (
    getStoreId(store) ===
    String(change.storeId)
  );

}
  
  /*
  이마트 형식
  */
  if (
    change.id !== undefined &&
    change.id !== null
  ) {

    return (
      getStoreId(store) ===
      String(change.id)
    );

  }


  /*
  롯데 형식
  */
  const changeOfficialId =
    String(
      change.officialStoreId ||
      ""
    );


  const storeOfficialId =
    String(
      store.officialStoreId ||
      ""
    );


  const changeStoreName =
    normalizeStoreName(
      change.store
    );


  const storeName =
    normalizeStoreName(
      store.store
    );


  if (
    changeOfficialId &&
    storeOfficialId
  ) {

    if (
      changeOfficialId !==
      storeOfficialId
    ) {

      return false;

    }


    /*
    같은 공식 점포코드가 중복되는 경우를 대비해
    점포명까지 함께 확인
    */
    if (
      changeStoreName &&
      storeName
    ) {

      return (
        changeStoreName ===
        storeName
      );

    }


    return true;

  }


  return (
    changeStoreName &&
    storeName &&
    changeStoreName ===
    storeName
  );

}

function buildChangeNotice(
  stores
) {

  if (
    !isChangeNoticeActive()
  ) {

    return "";

  }


  const changes =
    Array.isArray(
      changeStatusData?.changes
    )
      ? changeStatusData.changes
      : [];


  if (
    changes.length === 0
  ) {

    return "";

  }


  const monthKey =
    getSelectedMonthKey();


  /*
  현재 화면에 표시된 점포와 관련 있고,
  현재 보고 있는 달의 휴무일이 실제로 변경된 경우만 표시
  */
  const relevantChanges =
    changes.filter(
      change => {

        const matched =
          stores.some(
            store =>
              changeMatchesStore(
                change,
                store
              )
          );


        if (!matched) {

          return false;

        }


        const dates =
          getChangeHolidayDates(
            change
          );


        return dates.some(
          date =>
            String(date)
              .startsWith(
                monthKey
              )
        );

      }
    );


  if (
    relevantChanges.length === 0
  ) {

    return "";

  }

  const changeCards =
    relevantChanges
      .map(
        change => {

          const store =
            stores.find(
              item =>
                getStoreId(item) ===
                String(change.storeId)
            );

          return {
            change,
            store
          };

        }
      );


  const sampleNames =
    relevantChanges
      .slice(0, 4)
      .map(
        change =>
          shortStoreName(
            change.store || ""
          )
      );


  const extraCount =
    Math.max(
      0,
      relevantChanges.length -
      sampleNames.length
    );


  const storeText =
    sampleNames.join(", ")
    +
    (
      extraCount > 0
        ? ` 외 ${extraCount}개 점포`
        : ""
    );


  const checkedAt =
    formatCheckedAt(
      getChangeNoticeDate()
    );


  return `
    <div class="holiday-change-notice">

      <div class="holiday-change-icon">
        !
      </div>

      <div class="holiday-change-body">

        <div class="holiday-change-title">
          휴무 일정 변경이 확인되었습니다
        </div>

        <div class="holiday-change-text">
          공식 홈페이지의 휴무 일정이
          이전 확인 때와 달라졌습니다.
          현재 화면에는 최신 확인 결과가 반영되어 있습니다.
        </div>

        <div class="holiday-change-detail">
          변경 확인 점포:
          <strong>${storeText}</strong>
        </div>

                <div class="holiday-change-store-list">

        ${
          changeCards
            .slice(0, 10)
            .map(
              item => {

                const change =
                  item.change;

                const store =
                  item.store;

                return `
                  <div class="holiday-change-store-card">

                    <div class="holiday-change-store-name">
                      ${shortStoreName(
                        change.store || ""
                      )}
                    </div>

                    <div>
                      변경 전:
                      ${
                        (change.before || [])
                          .join(", ")
                      }
                    </div>

                    <div>
                      변경 후:
                      ${
                        (change.after || [])
                          .join(", ")
                      }
                    </div>

                    ${
                      store?.detailUrl
                        ?
                        `
                        <a
                          href="${store.detailUrl}"
                          target="_blank"
                        >
                          공식 매장정보
                        </a>
                        `
                        :
                        ""
                    }

                  </div>
                `;

              }
            )
            .join("")
        }

        </div>

        ${
          checkedAt
            ? `
              <div class="holiday-change-time">
                마지막 변경 확인:
                ${checkedAt}
              </div>
            `
            : ""
        }

      </div>

    </div>
  `;

}

function buildSpecialNotice() {

  const notice =
    changeStatusData?.specialNotice;


  if (
    !notice ||
    !notice.active
  ) {

    return "";

  }


  /*
  선택한 달과 특별 안내 대상 달이
  같은 경우에만 표시
  */
  if (
    notice.month &&
    notice.month !==
      getSelectedMonthKey()
  ) {

    return "";

  }


  const title =
    notice.type === "chuseok"
      ? "추석 특별 안내"
      : (
          notice.type === "seollal"
            ? "설날 특별 안내"
            : "명절 특별 안내"
        );


  const holidayDates =
    Array.isArray(
      notice.holidayDates
    )
      ? notice.holidayDates
      : [];


  const dateText =
  [...holidayDates]
    .sort(
      (a, b) =>
        String(a?.date || "")
          .localeCompare(
            String(b?.date || "")
          )
    )
    .map(
        item => {

          const date =
            item?.date || "";


          const name =
            item?.name || "";


          if (!date) {
            return name;
          }


          return (
            `${formatDate(date)}` +
            (
              name
                ? ` ${name}`
                : ""
            )
          );

        }
      )
      .filter(Boolean)
      .join(" · ");


  return `
    <div class="holiday-change-notice">

      <div class="holiday-change-icon">
        !
      </div>

      <div class="holiday-change-body">

        <div class="holiday-change-title">
          ${title}
        </div>

        ${
          dateText
            ? `
              <div class="holiday-change-detail">
                ${dateText}
              </div>
            `
            : ""
        }

        ${
          notice.message
            ? `
              <div class="holiday-change-text">
                ${notice.message}
              </div>
            `
            : ""
        }

      </div>

    </div>
  `;

}

/*
==================================================
점포명 클릭 안내
목록에서는 내부 단일 점포 화면으로,
단일 점포 화면의 공식 버튼만 외부 공식 페이지로 이동
==================================================
*/

function buildStoreClickGuide() {

  const regionGuide =
    selectedRegion === "all"
      ? `
        <span class="store-click-guide-line">
          <strong>지역별로 자세히 보려면 왼쪽 지역명을 클릭하세요.</strong>
        </span>
      `
      : "";


  const useInternalStoreView =
    MART_CONFIG.allRegionsStoreLinksUseInternalView === true
    &&
    !requestedStoreId;


  const storeGuideText =
    useInternalStoreView
      ? `
        <span class="store-click-guide-line">
          점포별 휴무일을 자세히 보려면
          <strong>아래 점포명을 클릭하세요.</strong>
        </span>

        <span class="store-click-guide-sub">
          같은 페이지에서 선택한 점포 1곳만 표시합니다.
        </span>
      `
      : `
        <span class="store-click-guide-line">
          점포별 영업시간·전화번호 등 자세한 정보는
          <strong>아래 점포명을 클릭해 확인할 수 있습니다.</strong>
        </span>

        <span class="store-click-guide-sub">
          ${MART_CONFIG.officialPageLabel || "공식 점포 페이지"}로 이동합니다.
        </span>
      `;


  return `
    <div class="store-click-guide">

      <span class="store-click-guide-icon">
        i
      </span>

      <span class="store-click-guide-body">

        <span class="store-click-guide-label">
          이용 안내
        </span>

        ${regionGuide}

        ${storeGuideText}

      </span>

    </div>
  `;

}


/*
==================================================
월간 달력
==================================================
*/

function buildMonthCalendar(stores) {

  const holidayStores = {};


  const prefix =
    getSelectedMonthKey() + "-";


  stores.forEach(
    store => {

      (store.holidays || [])
        .filter(
          date =>
            date.startsWith(prefix)
        )
        .forEach(
          date => {

            if (
              !holidayStores[
                date
              ]
            ) {

              holidayStores[
                date
              ] = [];

            }


            holidayStores[
              date
            ].push(
              store
            );

          }
        );

    }
  );


  /*
  같은 날짜에 같은 점포가
  중복으로 들어가는 경우를 방지합니다.
  */
  Object.keys(
    holidayStores
  ).forEach(
    date => {

      holidayStores[
        date
      ] = Array.from(
        new Map(
          holidayStores[
            date
          ].map(
            store => [
              getStoreId(
                store
              ),
              store
            ]
          )
        ).values()
      );

    }
  );


  const holidayCount = {};

  Object.entries(
    holidayStores
  ).forEach(
    ([
      date,
      dateStores
    ]) => {

      holidayCount[
        date
      ] = dateStores.length;

    }
  );


  const firstDay =
    new Date(
      selectedYear,
      selectedMonth - 1,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      selectedYear,
      selectedMonth,
      0
    ).getDate();


  const todayKey =
    dateToKey(
      koreaToday
    );


  const previousDisabled =
    !canMoveMonth(-1);


  const nextDisabled =
    !canMoveMonth(1);


  let html = `
    <div class="month-calendar">

      <div class="calendar-header">

        <button
          type="button"
          class="calendar-nav-button"
          data-month-step="-1"
          aria-label="이전 달"
          ${previousDisabled ? "disabled" : ""}
        >
          ‹
        </button>

        <div class="calendar-month-title">
          ${selectedYear}년 ${selectedMonth}월
        </div>

        <button
          type="button"
          class="calendar-nav-button"
          data-month-step="1"
          aria-label="다음 달"
          ${nextDisabled ? "disabled" : ""}
        >
          ›
        </button>

      </div>

      ${
        buildCalendarQuickSummary(
          holidayCount,
          stores
        )
      }

      <div class="calendar-grid">

        <div class="calendar-weekday sunday">일</div>
        <div class="calendar-weekday">월</div>
        <div class="calendar-weekday">화</div>
        <div class="calendar-weekday">수</div>
        <div class="calendar-weekday">목</div>
        <div class="calendar-weekday">금</div>
        <div class="calendar-weekday saturday">토</div>
  `;


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    html += `
      <div class="calendar-day calendar-empty"></div>
    `;

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateKey =
      `${selectedYear}-` +
      `${pad2(selectedMonth)}-` +
      `${pad2(day)}`;


    const dateStores =
      holidayStores[
        dateKey
      ] || [];


    const count =
      dateStores.length;


    const isClosed =
      count > 0;


    const isToday =
      dateKey === todayKey;


    const isPast =
      dateKey < todayKey;


    const weekdayIndex =
      new Date(
        selectedYear,
        selectedMonth - 1,
        day
      ).getDay();


    const weekdayClass =
      [
        "day-sun",
        "day-mon",
        "day-tue",
        "day-wed",
        "day-thu",
        "day-fri",
        "day-sat"
      ][weekdayIndex];


    const closedText =
      stores.length === 1
        ? "휴무"
        : `${count}개 점포`;


    const storeIds =
      encodeURIComponent(
        JSON.stringify(
          dateStores.map(
            store =>
              getStoreId(
                store
              )
          )
        )
      );


    html += `
      <div
        class="
          calendar-day
          ${weekdayClass}
          ${isClosed ? "closed calendar-day-clickable" : ""}
          ${isClosed && isPast ? "past-closed" : ""}
          ${isToday ? "today" : ""}
        "
        ${
          isClosed
            ? `
              data-calendar-date="${dateKey}"
              data-calendar-store-ids="${storeIds}"
              role="button"
              tabindex="0"
              title="${day}일 휴무 점포 보기"
            `
            : ""
        }
      >

        <div class="calendar-date-number">
          ${day}
        </div>

        ${
          isToday
            ? `
              <div class="calendar-today-label">
                오늘
              </div>
            `
            : ""
        }

        ${
          isClosed
            ? `
              <div class="calendar-closed-count">
                ${closedText}
              </div>
            `
            : ""
        }

      </div>
    `;

  }


  html += `
      </div>

      <div
        class="calendar-day-detail"
        hidden
      ></div>

      <div class="calendar-legend">
        색상이 표시된 날짜는 휴무일이며,
        지난 휴무일은 연하게 표시됩니다.
        휴무 날짜를 클릭하면 해당 점포를 확인할 수 있습니다.
      </div>

    </div>
  `;


  return html;

}

/*
==================================================
달력 휴무 날짜 클릭
==================================================
*/

function openCalendarDayDetail(
  calendarDay
) {

  const calendar =
    calendarDay.closest(
      ".month-calendar"
    );


  if (!calendar) {
    return;
  }


  const detail =
    calendar.querySelector(
      ".calendar-day-detail"
    );


  if (!detail) {
    return;
  }


  const dateKey =
    calendarDay.dataset
      .calendarDate || "";


  if (!dateKey) {
    return;
  }


  let storeIds = [];

  try {

    storeIds =
      JSON.parse(
        decodeURIComponent(
          calendarDay.dataset
            .calendarStoreIds ||
          "%5B%5D"
        )
      );

  } catch (error) {

    console.error(
      "달력 점포 ID 읽기 실패:",
      error
    );

    return;
  }


  const stores =
    storeIds
      .map(
        storeId =>
          holidayData.find(
            store =>
              getStoreId(
                store
              ) ===
              String(storeId)
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          String(
            a.store || ""
          ).localeCompare(
            String(
              b.store || ""
            ),
            "ko"
          )
      );


  /*
  같은 날짜를 다시 누르면 닫기
  */
  if (
    !detail.hidden
    &&
    detail.dataset.date ===
    dateKey
  ) {

    detail.hidden = true;

    detail.innerHTML = "";

    delete detail.dataset.date;

    calendar
      .querySelectorAll(
        ".calendar-day-selected"
      )
      .forEach(
        item =>
          item.classList.remove(
            "calendar-day-selected"
          )
      );

    return;
  }


  calendar
    .querySelectorAll(
      ".calendar-day-selected"
    )
    .forEach(
      item =>
        item.classList.remove(
          "calendar-day-selected"
        )
    );


  calendarDay.classList.add(
    "calendar-day-selected"
  );


  const parts =
    dateKey
      .split("-")
      .map(
        Number
      );


  const weekday =
    getWeekday(
      dateKey
    );


  const weekdayShort =
    weekday
      ? weekday.charAt(0)
      : "";


  const title =
    `${parts[0]}년 ` +
    `${parts[1]}월 ` +
    `${parts[2]}일` +
    (
      weekdayShort
        ? `(${weekdayShort})`
        : ""
    );


  let bodyHtml = "";


  /*
  전체 탭에서는 지역별로 묶기
  */
  if (
    selectedRegion === "all"
  ) {

    const regionGroups = {};


    stores.forEach(
      store => {

        const region =
          getStoreRegion(
            store
          ) || "기타";


        if (
          !regionGroups[
            region
          ]
        ) {

          regionGroups[
            region
          ] = [];

        }


        regionGroups[
          region
        ].push(
          store
        );

      }
    );


    const orderedRegions = [
      ...regionOrder.filter(
        region =>
          regionGroups[
            region
          ]
      ),

      ...Object.keys(
        regionGroups
      ).filter(
        region =>
          !regionOrder.includes(
            region
          )
      )
    ];


    bodyHtml =
      orderedRegions
        .map(
          region => {

            const links =
              regionGroups[
                region
              ]
                .map(
                  store => {

                    const displayName =
                      shortStoreName(
                        store.store
                      );

                    return `
                      <a
                        class="
                          calendar-day-store-link
                          store-link
                        "
                        href="${TISTORY_POST_URL}"
                        data-store-id="${getStoreId(store)}"
                        title="${displayName} 상세정보 보기"
                      >
                        ${displayName}
                      </a>
                    `;

                  }
                )
                .join(
                  `<span class="calendar-day-store-separator">, </span>`
                );


            return `
              <div class="calendar-day-detail-row">

                <div class="calendar-day-detail-region">
                  ${region}
                </div>

                <div class="calendar-day-detail-stores">
                  ${links}
                </div>

              </div>
            `;

          }
        )
        .join("");

  } else {

    bodyHtml =
      stores
        .map(
          store => {

            const displayName =
              shortStoreName(
                store.store
              );

            return `
              <a
                class="
                  calendar-day-store-link
                  store-link
                "
                href="${TISTORY_POST_URL}"
                data-store-id="${getStoreId(store)}"
                title="${displayName} 상세정보 보기"
              >
                ${displayName}
              </a>
            `;

          }
        )
        .join(
          `<span class="calendar-day-store-separator">, </span>`
        );

  }


  detail.innerHTML = `
    <div class="calendar-day-detail-title">
      ${title} 휴무 점포
      <span class="calendar-day-detail-count">
        · ${stores.length}곳
      </span>
    </div>

    <div class="calendar-day-detail-body">
      ${bodyHtml}
    </div>
  `;


  detail.dataset.date =
    dateKey;


  detail.hidden = false;

}


document.addEventListener(
  "click",
  function(event) {

    const calendarDay =
      event.target.closest(
        ".calendar-day-clickable"
      );


    if (!calendarDay) {
      return;
    }


    openCalendarDayDetail(
      calendarDay
    );

  }
);


document.addEventListener(
  "keydown",
  function(event) {

    if (
      event.key !== "Enter"
      &&
      event.key !== " "
    ) {

      return;

    }


    const calendarDay =
      event.target.closest(
        ".calendar-day-clickable"
      );


    if (!calendarDay) {
      return;
    }


    event.preventDefault();


    openCalendarDayDetail(
      calendarDay
    );

  }
);

/*
==================================================
상단 자동 안내문
휴무 데이터가 바뀌면 문구도 자동으로 변경됩니다.
==================================================
*/

function buildAutoSummary(
  stores,
  label
) {

  const monthStores =
    getMonthStores(stores);


  const dates =
    [
      ...new Set(
        monthStores.flatMap(
          store =>
            store.holidays
        )
      )
    ].sort();


  let message = "";


  if (
    dates.length === 0
  ) {

    message =
      `${selectedYear}년 ${selectedMonth}월 ` +
      `${label}에 등록된 휴무일이 없습니다.`;

  } else {

    const formattedDates =
      dates
        .map(
          date =>
            formatDate(date)
        )
        .join(" · ");


    message =
      `${selectedYear}년 ${selectedMonth}월 ` +
      `${label} 휴무일은 ` +
      `${formattedDates}입니다.`;

  }


  return `
    <div class="auto-summary">
      <strong>이번 달 안내</strong><br>
      ${message}
    </div>
  `;

}


/*
==================================================
이번 주 휴무 점포
선택 화면이 현재 달일 때만 표시
==================================================
*/

function buildThisWeekSummary(
  stores
) {

  const currentYear =
    koreaToday.getFullYear();


  const currentMonth =
    koreaToday.getMonth() + 1;


  /*
  다른 달을 보고 있을 때는
  이번 주 박스를 숨깁니다.
  */
  if (
    selectedYear !== currentYear ||
    selectedMonth !== currentMonth
  ) {

    return "";

  }


  const dayOfWeek =
    koreaToday.getDay();


  const mondayOffset =
    dayOfWeek === 0
      ? -6
      : 1 - dayOfWeek;


  const weekStart =
    new Date(koreaToday);


  weekStart.setDate(
    koreaToday.getDate() +
    mondayOffset
  );


  const weekEnd =
    new Date(weekStart);


  weekEnd.setDate(
    weekStart.getDate() + 6
  );


  const startKey =
    dateToKey(weekStart);


  const endKey =
    dateToKey(weekEnd);


  const dateGroups = {};


  stores.forEach(
    store => {

      (store.holidays || [])
        .forEach(
          date => {

            if (
              date >= startKey &&
              date <= endKey
            ) {

              if (!dateGroups[date]) {
                dateGroups[date] = [];
              }

              dateGroups[date].push(
                store
              );

            }

          }
        );

    }
  );


  const entries =
    Object.entries(
      dateGroups
    ).sort(
      ([a], [b]) =>
        a.localeCompare(b)
    );


  let html = `
    <div class="week-summary">

      <div class="week-summary-title">
        📅 이번 주 휴무 점포

        <span class="week-summary-period">
          ${formatDate(startKey)}
          ~
          ${formatDate(endKey)}
        </span>
      </div>
  `;


  if (
    entries.length === 0
  ) {

    html += `
      <div class="week-empty">
        이번 주에 예정된 휴무 점포가 없습니다.
      </div>
    `;

  } else {

    entries.forEach(
      ([date, storesInDate]) => {

        const uniqueStores =
          Array.from(
            new Map(
              storesInDate.map(
                store => [
                  getStoreId(store),
                  store
                ]
              )
            ).values()
          )
          .sort(
            (a, b) =>
              a.store.localeCompare(
                b.store,
                "ko"
              )
          );


        html += `
          <div class="week-date-block">

            <div class="week-date-title">
              ${formatDate(date)}
              ·
              ${uniqueStores.length}개 점포
            </div>

            <div class="week-store-grid">
        `;


        uniqueStores.forEach(
          store => {

            const displayName =
              shortStoreName(
                store.store
              );


            html += `
              <a
                class="store-grid-item store-link"
                href="${TISTORY_POST_URL}"
                data-store-id="${getStoreId(store)}"
                title="${displayName} 상세정보 보기"
              >
                ${displayName}
              </a>
            `;

          }
        );


        html += `
            </div>

          </div>
        `;

      }
    );

  }


  html += `
    </div>
  `;


  return html;

}


/*
==================================================
휴무 날짜 기준 요일 그룹 생성

중요:
점포 전체를 한 요일로 분류하지 않고,
각 휴무 날짜 하나하나를 해당 요일에 넣습니다.

예:
한 점포가 금요일 + 일요일에 모두 쉬면
금요일 그룹과 일요일 그룹 양쪽에 모두 표시됩니다.

이렇게 해야 달력의 점포 수와
하단 목록의 점포 수가 일치합니다.
==================================================
*/

function buildWeekdayGroups(
  stores
) {

  const groups = {};


  const monthStores =
    getMonthStores(
      stores
    );


  monthStores.forEach(
    store => {

      (store.holidays || [])
        .forEach(
          date => {

            const weekday =
              getWeekday(
                date
              );


            if (
              !groups[
                weekday
              ]
            ) {

              groups[
                weekday
              ] = [];

            }


            groups[
              weekday
            ].push({
              date,
              store
            });

          }
        );

    }
  );


  return groups;

}


/*
==================================================
지역 탭
==================================================
*/

function createTabs() {

  const tabs =
    document.getElementById(
      "tabs"
    );


  tabs.innerHTML = "";


  /*
  실제 점포가 존재하는 지역만 표시합니다.
  브랜드마다 없는 지역 탭은 자동으로 숨겨집니다.
  */
  const availableRegions =
    regionOrder.filter(
      region =>
        holidayData.some(
          item =>
            getStoreRegion(item) ===
            region
        )
    );


  if (
    !selectedSpecialType
    &&
    selectedRegion !== "all"
    &&
    !availableRegions.includes(
      selectedRegion
    )
    &&
    availableRegions.length > 0
  ) {

    selectedRegion =
      availableRegions[0];

  }


  const regionRow =
    document.createElement(
      "div"
    );


  regionRow.className =
    "tab-row region-tab-row";


  const allButton =
    document.createElement(
      "button"
    );


  allButton.className =
    "tab-button";


  if (
    selectedRegion === "all"
    &&
    !selectedSpecialType
  ) {

    allButton.classList.add(
      "active"
    );

  }


  allButton.textContent =
    "전체";


  allButton.addEventListener(
    "click",
    () => {

      selectedSpecialType =
        null;


      selectedRegion =
        "all";


      updateRegionInUrl(
        "all"
      );


      createTabs();

      renderAllRegions();

    }
  );


  regionRow.appendChild(
    allButton
  );


  availableRegions.forEach(
    region => {

      const button =
        document.createElement(
          "button"
        );


      button.className =
        "tab-button";


      if (
        !selectedSpecialType
        &&
        region ===
        selectedRegion
      ) {

        button.classList.add(
          "active"
        );

      }


      button.textContent =
        region;


      button.addEventListener(
        "click",
        () => {

          selectedSpecialType =
            null;


          selectedRegion =
            region;


          updateRegionInUrl(
            region
          );


          createTabs();

          renderRegion();

        }
      );


      regionRow.appendChild(
        button
      );

    }
  );


  tabs.appendChild(
    regionRow
  );


  /*
  브랜드 설정에 등록되고
  실제 점포가 존재하는 특수 유형만 표시합니다.
  */
  const availableSpecialTabs =
    specialStoreTabs.filter(
      tab =>
        holidayData.some(
          item =>
            getStoreType(item) ===
            tab.type
        )
    );


  if (
    availableSpecialTabs.length === 0
  ) {

    return;

  }


  const specialRow =
    document.createElement(
      "div"
    );


  specialRow.className =
    "tab-row special-store-tab-row";


  specialRow.setAttribute(
    "aria-label",
    "매장 유형"
  );


  const label =
    document.createElement(
      "span"
    );


  label.className =
    "special-filter-label";


  label.textContent =
    "매장 유형";


  specialRow.appendChild(
    label
  );


  availableSpecialTabs.forEach(
    tab => {

      const button =
        document.createElement(
          "button"
        );


      const safeType =
        tab.type.replace(
          /[^a-z0-9_-]/gi,
          ""
        );


      button.className =
        "tab-button " +
        "special-filter-button " +
        "special-filter-button-" +
        safeType;


      if (
        selectedSpecialType ===
        tab.type
      ) {

        button.classList.add(
          "active"
        );

      }


      button.textContent =
        tab.label;


      button.addEventListener(
        "click",
        () => {

          selectedSpecialType =
            tab.type;


          selectedRegion =
            "all";


          updateSpecialTypeInUrl(
            tab.type
          );


          createTabs();

          renderSpecialType();

        }
      );


      specialRow.appendChild(
        button
      );

    }
  );


  tabs.appendChild(
    specialRow
  );

}

/*
==================================================
개별 점포 화면
==================================================
*/

function renderSingleStore(store) {

  document.body.classList.remove(
    "all-regions-mode"
  );


  const tabs =
    document.getElementById(
      "tabs"
    );


  const content =
    document.getElementById(
      "content"
    );


  const description =
    document.getElementById(
      "page-description"
    );

/*
전국 보기에서도 지역 탭을 표시하고
휴무 패턴 중심 압축 화면을 사용합니다.
*/
  tabs.style.display =
    "none";


  const displayName =
    shortStoreName(
      store.store
    );


  const monthHolidays =
    getMonthHolidays(store);


  const dates =
    monthHolidays
      .map(
        date =>
          formatDate(date)
      )
      .join(" · ");


  description.textContent =
    `${displayName}의 휴무일을 확인할 수 있습니다.`;


  content.innerHTML = `

    <div class="single-store-toolbar">
      <a
        class="single-store-back-link"
        href="${buildStoreListReturnUrl()}"
      >
        <span aria-hidden="true">←</span>
        점포 목록으로
      </a>
    </div>

    <h2 class="region-title">

      ${displayName}

      <span class="region-count">
        · ${getStoreRegion(store)}
      </span>

    </h2>

    ${
      buildChangeNotice(
        [store]
      )
    }

    ${
      buildSpecialNotice()
    }
      
    ${
      buildMonthCalendar(
        [store]
      )
    }


    <div class="holiday-accordion">

      <div
        class="accordion-content"
        style="padding-top:20px;"
      >

        <div class="date-title">
          ${selectedYear}년 ${selectedMonth}월 휴무일
        </div>

        <div class="store-grid-item">
          ${
            dates ||
            "등록된 휴무일이 없습니다."
          }
        </div>

        <div style="margin-top:18px;">

          <a
            class="store-detail-button store-link"
            href="${TISTORY_POST_URL}"
            data-store-id="${getStoreId(store)}"
            title="${displayName} 상세정보 보기"
          >

            <span class="store-detail-text">

              <span>
                ${MART_CONFIG.officialPageLabel || "공식 점포 페이지"} 열기
              </span>

              <span class="store-detail-sub">
                외부 공식 홈페이지로 이동합니다.
              </span>

            </span>

            <span class="store-detail-arrow">
              →
            </span>

          </a>

        </div>

        ${buildStoreBasicInfo(
          store
        )}

      </div>

    </div>
  `;

}


/*
==================================================
지역/전국 공통 화면
==================================================
*/

function renderStoreCollection(
  stores,
  titleText,
  descriptionText,
  showRegionName = false
) {

  const content =
    document.getElementById(
      "content"
    );


  const description =
    document.getElementById(
      "page-description"
    );


  const monthStores =
    getMonthStores(
      stores
    );


  description.textContent =
    descriptionText;


  content.innerHTML = `

    <h2 class="region-title">

      ${titleText}

      <span class="region-count">
        · ${stores.length}개 점포
      </span>

    </h2>

    ${
      buildChangeNotice(
        stores
      )
    }

    ${
       buildSpecialNotice()
    }

    ${
      buildMonthCalendar(
        stores
      )
    }

    ${
      buildStoreClickGuide()
    }
  `;


  if (
    monthStores.length === 0
  ) {

    content.innerHTML += `
      <div class="empty">
        ${selectedYear}년 ${selectedMonth}월에
        등록된 휴점일 데이터가 없습니다.
      </div>
    `;

    return;

  }


  /*
  각 휴무 날짜를 기준으로
  요일 그룹에 넣습니다.
  */
  const weekdayGroups =
    buildWeekdayGroups(
      stores
    );


  const displayOrder = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일"
  ];


  displayOrder.forEach(
    groupName => {

      const entries =
        weekdayGroups[
          groupName
        ];


      if (
        !entries ||
        entries.length === 0
      ) {

        return;

      }


      /*
      요일 제목의 점포 수는
      같은 점포가 여러 날짜에 있어도
      한 번만 계산합니다.
      */
      const uniqueStoreCount =
        new Set(
          entries.map(
            item =>
              getStoreId(
                item.store
              )
          )
        ).size;


      const dateGroups = {};


      entries.forEach(
        item => {

          if (
            !dateGroups[
              item.date
            ]
          ) {

            dateGroups[
              item.date
            ] = [];

          }


          dateGroups[
            item.date
          ].push(
            item.store
          );

        }
      );


      let html = `
        <details
          class="holiday-accordion"
          open
        >

          <summary>
            ${groupName} 휴무
            · ${uniqueStoreCount}개 점포
          </summary>

          <div class="accordion-content">
      `;


      Object.entries(
        dateGroups
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(b)
        )
        .forEach(
          ([date, storesInDate]) => {

            html += `
              <div class="date-group">

                <div class="date-title">
                  ${formatDate(date)}
                  · ${storesInDate.length}개 점포
                </div>

                <div class="store-grid">
            `;


            storesInDate
              .sort(
                (a, b) =>
                  a.store.localeCompare(
                    b.store,
                    "ko"
                  )
              )
              .forEach(
                store => {

                  const displayName =
                    shortStoreName(
                      store.store
                    );


                  const visibleName =
                    showRegionName
                      ? `${displayName} · ${getStoreRegion(store)}`
                      : displayName;


                  html += `
                    <a
                      class="store-grid-item store-link"
                      href="${TISTORY_POST_URL}"
                      data-store-id="${getStoreId(store)}"
                      title="${displayName} 상세정보 보기"
                    >
                      ${visibleName}
                    </a>
                  `;

                }
              );


            html += `
                </div>

              </div>
            `;

          }
        );


      html += `
          </div>

        </details>
      `;


      content.innerHTML +=
        html;

    }
  );

}

/*
==================================================
지역 화면 - 휴무 패턴 중심
==================================================
*/

function renderRegionPatternView(
  stores,
  titleText,
  descriptionText
) {

  const content =
    document.getElementById(
      "content"
    );

  const description =
    document.getElementById(
      "page-description"
    );

  const monthStores =
    getMonthStores(
      stores
    );


  description.textContent =
    descriptionText;


  content.innerHTML = `

    <h2 class="region-title">

      ${titleText}

      <span class="region-count">
        · ${stores.length}개 점포
      </span>

    </h2>

    ${
      buildChangeNotice(
        stores
      )
    }

    ${
      buildSpecialNotice()
    }

    ${
      buildMonthCalendar(
        stores
      )
    }

    ${
      buildStoreClickGuide()
    }

  `;


  if (
    monthStores.length === 0
  ) {

    content.innerHTML += `
      <div class="empty">
        ${selectedYear}년 ${selectedMonth}월에
        등록된 휴점일 데이터가 없습니다.
      </div>
    `;

    return;
  }


  const monthKey =
    getSelectedMonthKey();


  /*
  ==================================================
  점포별 해당 월 전체 휴무일
  ==================================================
  */

  function getStoreMonthDates(
    store
  ) {

    return Array.from(
      new Set(
        (
          Array.isArray(
            store.holidays
          )
            ? store.holidays
            : []
        )
          .map(
            value =>
              String(value)
          )
          .filter(
            value =>
              value.startsWith(
                monthKey
              )
          )
      )
    ).sort();

  }


  /*
  ==================================================
  날짜 간단 표시
  ==================================================
  */

 function compactDate(
  date
) {

  const parts =
    String(date)
      .split("-")
      .map(
        Number
      );

  if (
    parts.length !== 3
  ) {

    return String(date);
  }

  const weekday =
    getWeekday(
      String(date)
    );

  const weekdayShort =
    weekday
      ? weekday.charAt(0)
      : "";

  return (
    `${parts[1]}/${parts[2]}` +
    (
      weekdayShort
        ? `(${weekdayShort})`
        : ""
    )
  );
}


  /*
  ==================================================
  정기 휴무 패턴 판정

  예)
  9/13 + 9/27
  → 2·4째 일요일

  9/9 + 9/23
  → 2·4째 수요일
  ==================================================
  */

  function getRegularPattern(
    dates
  ) {

    if (
      dates.length !== 2
    ) {

      return null;
    }


    const weekdayNames = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일"
    ];


    const info =
      dates.map(
        date => {

          const [
            year,
            month,
            day
          ] =
            String(date)
              .split("-")
              .map(
                Number
              );


          const jsDate =
            new Date(
              year,
              month - 1,
              day
            );


          return {

            weekday:
              jsDate.getDay(),

            week:
              Math.ceil(
                day / 7
              )

          };

        }
      );


    /*
    서로 요일이 다르면
    정기 패턴으로 보지 않습니다.
    */

    if (
      info[0].weekday !==
      info[1].weekday
    ) {

      return null;
    }


    const weeks =
      info
        .map(
          item =>
            item.week
        )
        .sort(
          (a, b) =>
            a - b
        );


    if (
      weeks[0] ===
      weeks[1]
    ) {

      return null;
    }


    return {

      key:
        `regular-${weeks[0]}-${weeks[1]}-${info[0].weekday}`,

      label:
        `${weeks[0]}·${weeks[1]}째 ${weekdayNames[info[0].weekday]} 휴무`,

      weekday:
        info[0].weekday,

      weeks:
        weeks,

      dates:
        dates

    };

  }


  /*
  ==================================================
  점포 중복 제거 + 가나다 정렬
  ==================================================
  */

  function uniqueSortedStores(
    storeList
  ) {

    return Array.from(
      new Map(
        storeList.map(
          store => [
            getStoreId(
              store
            ),
            store
          ]
        )
      ).values()
    )
      .sort(
        (a, b) =>
          a.store.localeCompare(
            b.store,
            "ko"
          )
      );

  }


  /*
  ==================================================
  점포 그리드
  ==================================================
  */

  function buildStoreGrid(
    storeList
  ) {

    const uniqueStores =
      uniqueSortedStores(
        storeList
      );


    let html = `
      <div class="store-grid">
    `;


    uniqueStores.forEach(
      store => {

        const displayName =
          shortStoreName(
            store.store
          );


        html += `

          <a
            class="
              store-grid-item
              store-link
            "
            href="${TISTORY_POST_URL}"
            data-store-id="${getStoreId(store)}"
            title="${displayName} 상세정보 보기"
          >
            ${displayName}
          </a>

        `;

      }
    );


    html += `
      </div>
    `;


    return html;

  }


  /*
  ==================================================
  정기 패턴 / 기타 패턴 분류
  ==================================================
  */

  const regularGroups = {};

  const otherGroups = {};


  monthStores.forEach(
    store => {

      const dates =
        getStoreMonthDates(
          store
        );


      if (
        dates.length === 0
      ) {

        return;
      }


      const regular =
        getRegularPattern(
          dates
        );


      if (
        regular
      ) {

        if (
          !regularGroups[
            regular.key
          ]
        ) {

          regularGroups[
            regular.key
          ] = {

            ...regular,

            stores:
              []

          };

        }


        regularGroups[
          regular.key
        ].stores.push(
          store
        );


        return;
      }


      /*
      정기 패턴이 아니면
      실제 휴무 날짜 조합으로 묶습니다.
      */

      const key =
        dates.join("|");


      if (
        !otherGroups[
          key
        ]
      ) {

        otherGroups[
          key
        ] = {

          dates:
            dates,

          stores:
            []

        };

      }


      otherGroups[
        key
      ].stores.push(
        store
      );

    }
  );


  /*
  ==================================================
  정기 패턴 출력 순서

  일요일
  수요일
  월요일
  나머지
  ==================================================
  */

  const weekdayOrder = {

    0: 0,
    3: 1,
    1: 2,
    2: 3,
    4: 4,
    5: 5,
    6: 6

  };


  const orderedRegularGroups =
    Object.values(
      regularGroups
    )
      .sort(
        (a, b) => {

          const weekdayDiff =
            weekdayOrder[
              a.weekday
            ]
            -
            weekdayOrder[
              b.weekday
            ];


          if (
            weekdayDiff !== 0
          ) {

            return weekdayDiff;

          }


          return (
            b.stores.length -
            a.stores.length
          );

        }
      );


  /*
  ==================================================
  정기 휴무 출력
  ==================================================
  */

  orderedRegularGroups.forEach(
    group => {

      const dateText =
        group.dates
          .map(
            compactDate
          )
          .join(", ");


      const html = `

        <details
          class="holiday-accordion"
          open
        >

          <summary>

            ${group.label}

            · ${group.stores.length}개 점포

          </summary>


          <div class="accordion-content">

            <div class="date-group">

              <div class="date-title">
                ${dateText}
              </div>

              ${
                buildStoreGrid(
                  group.stores
                )
              }

            </div>

          </div>

        </details>

      `;


      content.innerHTML +=
        html;

    }
  );


  /*
  ==================================================
  기타 휴무
  ==================================================
  */

  const orderedOtherGroups =
    Object.values(
      otherGroups
    )
      .sort(
        (a, b) =>
          a.dates
            .join("|")
            .localeCompare(
              b.dates
                .join("|")
            )
      );


  if (
    orderedOtherGroups.length >
    0
  ) {

    const otherStoreCount =
      new Set(
        orderedOtherGroups
          .flatMap(
            group =>
              group.stores
          )
          .map(
            store =>
              getStoreId(
                store
              )
          )
      ).size;


    let html = `

      <details
        class="holiday-accordion"
        open
      >

        <summary>

          기타 휴무

          · ${otherStoreCount}개 점포

        </summary>


        <div class="accordion-content">

    `;


    orderedOtherGroups.forEach(
      group => {

        const dateText =
          group.dates
            .map(
              compactDate
            )
            .join(", ");


        html += `

          <div class="date-group">

            <div class="date-title">

              ${dateText}

              · ${group.stores.length}개 점포

            </div>


            ${
              buildStoreGrid(
                group.stores
              )
            }

          </div>

        `;

      }
    );


    html += `

        </div>

      </details>

    `;


    content.innerHTML +=
      html;

  }

}

/*
==================================================
지역 화면
==================================================
*/

function renderRegion() {

  document.body.classList.remove(
    "all-regions-mode"
  );


  const tabs =
    document.getElementById(
      "tabs"
    );

/*
전국 보기에서도 지역 탭을 표시하고
휴무 패턴 중심 압축 화면을 사용합니다.
*/
  tabs.style.display =
    "";


  const stores =
    holidayData.filter(
      item =>
        getStoreRegion(item) ===
        selectedRegion
    );


  renderRegionPatternView(
    stores,
    `${selectedRegion} 지역`,
    `${selectedRegion} 지역의 ${MART_CONFIG.brandName || "마트"} 휴무일을 휴무 패턴별로 확인할 수 있습니다.`
  );

}


/*
==================================================
전국 전체 점포 화면

주소:
?region=all
==================================================
*/
function renderAllRegions(
  stores = holidayData,
  titleText = "전국",
  descriptionText = null
) {

  const targetStores =
    Array.isArray(stores)
      ? stores
      : holidayData;

  const tabs =
    document.getElementById(
      "tabs"
    );

  const content =
    document.getElementById(
      "content"
    );

  const description =
    document.getElementById(
      "page-description"
    );


  /*
  전국 보기에서는 지역 탭을 숨기고
  휴무 패턴 중심 압축 화면을 사용합니다.
  */
  tabs.style.display =
    "";

  document.body.classList.add(
    "all-regions-mode"
  );

  description.textContent =
    descriptionText ||
    `전국의 ${MART_CONFIG.brandName || "마트"} 휴무일을 휴무 유형별로 한눈에 확인할 수 있습니다.`;


  const monthStores =
    getMonthStores(
      targetStores
    );


  content.innerHTML = `

    <h2 class="region-title">

      ${titleText}

      <span class="region-count">
        · ${targetStores.length}개 점포
      </span>

    </h2>

    ${
      buildChangeNotice(
        targetStores
      )
    }

    ${
      buildSpecialNotice()
    }

    ${
      buildMonthCalendar(
        targetStores
      )
    }

    ${
      buildStoreClickGuide()
    }
  `;


  if (
    monthStores.length === 0
  ) {

    content.innerHTML += `
      <div class="empty">
        ${selectedYear}년 ${selectedMonth}월에
        등록된 휴점일 데이터가 없습니다.
      </div>
    `;

    return;
  }


  /*
  ==================================================
  선택 월
  ==================================================
  */

  const monthKey =
    getSelectedMonthKey();


  /*
  ==================================================
  점포별 해당 월 휴무일
  ==================================================
  */

  function getStoreMonthDates(
    store
  ) {

    const holidays =
      Array.isArray(
        store.holidays
      )
        ? store.holidays
        : [];


    return Array.from(
      new Set(
        holidays
          .map(
            value =>
              String(value)
          )
          .filter(
            value =>
              value.startsWith(
                monthKey
              )
          )
      )
    ).sort();

  }


  /*
  ==================================================
  날짜 압축
  2026-09-13 → 9/13
  ==================================================
  */

function compactDate(
  date
) {

  const parts =
    String(date)
      .split("-")
      .map(
        Number
      );

  if (
    parts.length !== 3
  ) {

    return String(date);
  }

  const weekday =
    getWeekday(
      String(date)
    );

  const weekdayShort =
    weekday
      ? weekday.charAt(0)
      : "";

  return (
    `${parts[1]}/${parts[2]}` +
    (
      weekdayShort
        ? `(${weekdayShort})`
        : ""
    )
  );
}


  /*
  ==================================================
  정기 휴무 패턴 판정

  예:
  9/13 + 9/27
  → 2·4째 일요일

  9/9 + 9/23
  → 2·4째 수요일
  ==================================================
  */

  function getRegularPattern(
    dates
  ) {

    if (
      dates.length !== 2
    ) {

      return null;
    }


    const weekdayNames = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일"
    ];


    const dateInfo =
      dates.map(
        date => {

          const [
            year,
            month,
            day
          ] =
            String(date)
              .split("-")
              .map(
                Number
              );


          const jsDate =
            new Date(
              year,
              month - 1,
              day
            );


          return {

            weekday:
              jsDate.getDay(),

            week:
              Math.ceil(
                day / 7
              )

          };

        }
      );


    if (
      dateInfo[0].weekday !==
      dateInfo[1].weekday
    ) {

      return null;
    }


    const weeks =
      dateInfo
        .map(
          item =>
            item.week
        )
        .sort(
          (a, b) =>
            a - b
        );


    /*
    동일 요일 + 서로 다른 주차이면
    정기 패턴으로 표시합니다.
    */

    if (
      weeks[0] ===
      weeks[1]
    ) {

      return null;
    }


    return {

      key:
        `regular-${weeks[0]}-${weeks[1]}-${dateInfo[0].weekday}`,

      label:
        `${weeks[0]}·${weeks[1]}째 ${weekdayNames[dateInfo[0].weekday]} 휴무`,

      weekday:
        dateInfo[0].weekday,

      weeks:
        weeks,

      dates:
        dates

    };

  }


  /*
  ==================================================
  도 이름 축약
  ==================================================
  */

  function getProvinceShortName(
    store
  ) {

    const sido =
      String(
        store?.sido || ""
      ).trim();


    const map = {

      "경상북도":
        "경북",

      "경상남도":
        "경남",

      "충청북도":
        "충북",

      "충청남도":
        "충남",

      "전라북도":
        "전북",

      "전북특별자치도":
        "전북",

      "전라남도":
        "전남",

      "강원특별자치도":
        "강원",

      "강원도":
        "강원",

      "제주특별자치도":
        "제주"

    };


    return (
      map[sido] ||
      normalizeRegionName(
        sido
      ) ||
      sido
    );

  }


  /*
  ==================================================
  경기/충청/전라/경상 등
  점포가 많은 지역에서 사용할
  시·군 단위 이름
  ==================================================
  */

  function getLocalGroupName(
    store,
    region
  ) {

    const sigungu =
      String(
        store?.sigungu || ""
      ).trim();


    if (
      region === "충청"
      ||
      region === "전라"
      ||
      region === "경상"
    ) {

      const province =
        getProvinceShortName(
          store
        );


      return [
        province,
        sigungu
      ]
        .filter(
          Boolean
        )
        .join(" ");

    }


    return (
      sigungu ||
      region
    );

  }


  /*
  ==================================================
  점포 중복 제거 + 정렬
  ==================================================
  */

  function uniqueSortedStores(
    stores
  ) {

    return Array.from(
      new Map(
        stores.map(
          store => [
            getStoreId(
              store
            ),
            store
          ]
        )
      ).values()
    )
      .sort(
        (a, b) =>
          a.store.localeCompare(
            b.store,
            "ko"
          )
      );

  }


  /*
  ==================================================
  점포 링크
  ==================================================
  */

  function buildStoreLinks(
    stores
  ) {

    return uniqueSortedStores(
      stores
    )
      .map(
        store => {

          const displayName =
            shortStoreName(
              store.store
            );

          const formattedDisplayName =
            formatStoreDisplayName(
              store
            );


          return `
            <a
              class="
                all-regions-store-link
                store-link
              "
              href="${TISTORY_POST_URL}"
              data-store-id="${getStoreId(store)}"
              title="${displayName} 상세정보 보기"
            >
              ${formattedDisplayName}
            </a>
          `;

        }
      )
      .join(
        `
        <span class="
          all-regions-separator
        ">,</span>
        `
      );

  }


  /*
  ==================================================
  지역별 점포 표현

  점포가 적으면 그냥 점포명 표시

  경기·충청·전라·경상처럼
  점포가 많으면 시·군 단위로 압축
  ==================================================
  */

function buildRegionStoreSummary(
  stores,
  region
) {

  const uniqueStores =
    uniqueSortedStores(
      stores
    );


  const complexRegion =
    MART_CONFIG.showLocalBadgeForAllRegions === true
    ||
    region === "경기"
    ||
    region === "충청"
    ||
    region === "전라"
    ||
    region === "경상"
    ||
    region === "강원";


  /*
  경기·충청·전라·경상이 아니면
  기존처럼 점포명만 표시
  */
  if (
    !complexRegion
  ) {

    return buildStoreLinks(
      uniqueStores
    );

  }


  /*
  실제 시·군·구 정보가 있는 점포가
  하나라도 있는지 확인

  이마트처럼 sigungu가 전혀 없으면
  빈 배지를 만들지 않고 점포명만 표시
  */
  const hasLocalData =
    uniqueStores.some(
      store =>
        String(
          store?.sigungu || ""
        ).trim()
    );


  if (
    !hasLocalData
  ) {

    return buildStoreLinks(
      uniqueStores
    );

  }


  const localGroups = {};

  const noLocalStores = [];


  uniqueStores.forEach(
    store => {

      const sigungu =
        String(
          store?.sigungu || ""
        ).trim();


      /*
      일부 점포만 sigungu가 없으면
      빈 배지를 만들지 않음
      */
      if (
        !sigungu
      ) {

        noLocalStores.push(
          store
        );

        return;

      }


      const localName =
        getLocalGroupName(
          store,
          region
        );


      if (
        !localName
      ) {

        noLocalStores.push(
          store
        );

        return;

      }


      if (
        !localGroups[
          localName
        ]
      ) {

        localGroups[
          localName
        ] = [];

      }


      localGroups[
        localName
      ].push(
        store
      );

    }
  );


  const groupedHtml =
    Object.entries(
      localGroups
    )
      .sort(
        ([a], [b]) =>
          a.localeCompare(
            b,
            "ko"
          )
      )
      .map(
        ([
          localName,
          localStores
        ]) => {

          return `
            <span class="
              all-regions-local-group
            ">

              <span class="
                all-regions-local-badge
              ">
                ${localName}
              </span>

              <span class="
                all-regions-local-stores
              ">
                ${buildStoreLinks(
                  localStores
                )}
              </span>

            </span>
          `;

        }
      )
      .join(
        `
        <span class="
          all-regions-local-separator
        ">
          ·
        </span>
        `
      );


  const noLocalHtml =
    noLocalStores.length > 0
      ? buildStoreLinks(
          noLocalStores
        )
      : "";


  if (
    groupedHtml
    &&
    noLocalHtml
  ) {

    return `
      ${groupedHtml}

      <span class="
        all-regions-local-separator
      ">
        ·
      </span>

      ${noLocalHtml}
    `;

  }


  return (
    groupedHtml
    ||
    noLocalHtml
  );

}


  /*
  ==================================================
  정기 패턴 / 기타 패턴 수집
  ==================================================
  */

  const regularGroups = {};

  const otherGroups = {};


  monthStores.forEach(
    store => {

      const dates =
        getStoreMonthDates(
          store
        );


      if (
        dates.length === 0
      ) {

        return;
      }


      const regular =
        getRegularPattern(
          dates
        );


      if (
        regular
      ) {

        if (
          !regularGroups[
            regular.key
          ]
        ) {

          regularGroups[
            regular.key
          ] = {

            ...regular,

            stores:
              []

          };

        }


        regularGroups[
          regular.key
        ].stores.push(
          store
        );


        return;
      }


      /*
      규칙형이 아닌 휴무는
      날짜 조합 자체를 기준으로 묶습니다.
      */

      const otherKey =
        dates.join("|");


      if (
        !otherGroups[
          otherKey
        ]
      ) {

        otherGroups[
          otherKey
        ] = {

          dates:
            dates,

          stores:
            []

        };

      }


      otherGroups[
        otherKey
      ].stores.push(
        store
      );

    }
  );


  /*
  ==================================================
  정기 휴무 순서

  가장 흔한 순서:
  일요일 → 수요일 → 월요일 → 나머지
  ==================================================
  */

  const weekdayOrder = {
    0: 0,
    3: 1,
    1: 2,
    2: 3,
    4: 4,
    5: 5,
    6: 6
  };


  const orderedRegularGroups =
    Object.values(
      regularGroups
    )
      .sort(
        (a, b) => {

          const weekdayDiff =
            weekdayOrder[
              a.weekday
            ]
            -
            weekdayOrder[
              b.weekday
            ];


          if (
            weekdayDiff !== 0
          ) {

            return weekdayDiff;

          }


          return (
            b.stores.length -
            a.stores.length
          );

        }
      );


  /*
  ==================================================
  패턴 하나를 지역별로 출력
  ==================================================
  */

  function buildPatternRegionRows(
    stores
  ) {

    const regionGroups = {};


    stores.forEach(
      store => {

        const region =
          getStoreRegion(
            store
          )
          ||
          "기타";


        if (
          !regionGroups[
            region
          ]
        ) {

          regionGroups[
            region
          ] = [];

        }


        regionGroups[
          region
        ].push(
          store
        );

      }
    );


    const orderedRegions = [

      ...regionOrder.filter(
        region =>
          regionGroups[
            region
          ]
      ),

      ...Object.keys(
        regionGroups
      ).filter(
        region =>
          !regionOrder.includes(
            region
          )
      )

    ];


    let html = "";


    orderedRegions.forEach(
      region => {

        html += `

          <div class="
            all-regions-row
          ">

            <div class="
              all-regions-region
            ">

              <a
                class="
                  all-regions-region-link
                "
                href="?region=${encodeURIComponent(region)}&date=${encodeURIComponent(getSelectedMonthKey())}"
                title="${region} 지역만 보기"
              >
                ${region}

                <span class="
                  all-regions-region-arrow
                ">›</span>

              </a>

            </div>


            <div class="
              all-regions-stores
            ">
              ${
                buildRegionStoreSummary(
                  regionGroups[
                    region
                  ],
                  region
                )
              }
            </div>

          </div>
        `;

      }
    );


    return html;

  }


  /*
  ==================================================
  정기 휴무 패턴 출력
  ==================================================
  */

  orderedRegularGroups.forEach(
    group => {

      const dateText =
        group.dates
          .map(
            compactDate
          )
          .join(", ");


      let html = `

        <details
          class="
            holiday-accordion
            all-regions-accordion
          "
          open
        >

          <summary>

            ${group.label}

            <span class="
              region-count
            ">
              · ${group.stores.length}개 점포
            </span>

          </summary>


          <div class="
            accordion-content
            all-regions-content
          ">


            <div class="
              all-regions-date-title
            ">
              ${dateText}
            </div>


            ${
              buildPatternRegionRows(
                group.stores
              )
            }


          </div>

        </details>
      `;


      content.innerHTML +=
        html;

    }
  );


  /*
  ==================================================
  기타 휴무
  ==================================================
  */

  const orderedOtherGroups =
    Object.values(
      otherGroups
    )
      .sort(
        (a, b) => {

          const dateCompare =
            a.dates
              .join("|")
              .localeCompare(
                b.dates
                  .join("|")
              );


          return dateCompare;

        }
      );


  if (
    orderedOtherGroups.length >
    0
  ) {

    const otherStoreCount =
      new Set(
        orderedOtherGroups
          .flatMap(
            group =>
              group.stores
          )
          .map(
            store =>
              getStoreId(
                store
              )
          )
      ).size;


    let html = `

      <details
        class="
          holiday-accordion
          all-regions-accordion
        "
        open
      >

        <summary>

          기타 휴무

          <span class="
            region-count
          ">
            · ${otherStoreCount}개 점포
          </span>

        </summary>


        <div class="
          accordion-content
          all-regions-content
        ">
    `;


    orderedOtherGroups.forEach(
      group => {

        const dateText =
          group.dates
            .map(
              compactDate
            )
            .join(", ");


        html += `

          <div class="
            all-regions-date-group
          ">

            <div class="
              all-regions-date-title
            ">
              ${dateText}
              · ${group.stores.length}개 점포
            </div>


            ${
              buildPatternRegionRows(
                group.stores
              )
            }


          </div>
        `;

      }
    );


    html += `

        </div>

      </details>
    `;


    content.innerHTML +=
      html;

  }

}



/*
==================================================
특수 매장 유형 화면
==================================================
*/

function renderSpecialType() {

  const tab =
    specialStoreTabs.find(
      item =>
        item.type ===
        selectedSpecialType
    );


  if (!tab) {

    selectedSpecialType =
      null;


    renderAllRegions();

    return;

  }


  const stores =
    holidayData.filter(
      item =>
        getStoreType(item) ===
        tab.type
    );


  renderAllRegions(
    stores,
    tab.label,
    `전국의 ${tab.label} 점포 휴무일만 모아서 확인할 수 있습니다.`
  );

}


/*
현재 화면 다시 그리기
달력 좌우 버튼에서 사용
*/
function renderCurrentView() {

  if (
    requestedStoreId
  ) {

    const store =
      holidayData.find(
        item =>
          getStoreId(item) ===
          String(requestedStoreId)
      );


    if (store) {

      renderSingleStore(
        store
      );

    }

    return;

  }


  createTabs();


  if (
    selectedSpecialType
  ) {

    renderSpecialType();

    return;

  }


  if (
    selectedRegion === "all"
  ) {

    renderAllRegions();

    return;

  }


  renderRegion();

}


/*
==================================================
달력 이전/다음 달 버튼
==================================================
*/

document.addEventListener(
  "click",
  function(event) {

    const button =
      event.target.closest(
        ".calendar-nav-button"
      );


    if (!button) {
      return;
    }


    event.preventDefault();


    if (button.disabled) {
      return;
    }


    const step =
      Number(
        button.dataset.monthStep
      );


    moveMonth(
      step
    );

  }
);


/*
==================================================
점포 1곳 내부 화면 주소 생성
==================================================
*/

function buildInternalStoreViewUrl(
  storeId
) {

  const params =
    new URLSearchParams(
      window.location.search
    );


  params.set(
    "storeId",
    String(storeId)
  );


  params.set(
    "date",
    getSelectedMonthKey()
  );


  if (
    selectedRegion === "all"
  ) {

    params.set(
      "region",
      "all"
    );

  }


  return (
    window.location.pathname
    +
    "?"
    +
    params.toString()
    +
    window.location.hash
  );

}

/*
==================================================
단일 점포 화면 → 원래 목록 화면 주소 생성
==================================================
*/

function buildStoreListReturnUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  params.delete(
    "storeId"
  );


  params.set(
    "date",
    getSelectedMonthKey()
  );


  if (
    !params.get(
      "region"
    )
  ) {

    params.set(
      "region",
      "all"
    );

  }


  return (
    window.location.pathname
    +
    "?"
    +
    params.toString()
    +
    window.location.hash
  );

}


/*
==================================================
점포 클릭 처리
==================================================
*/

document.addEventListener(
  "click",
  function(event) {

    const link =
      event.target.closest(
        ".store-link"
      );


    if (!link) {
      return;
    }


    event.preventDefault();


    const storeId =
      link.dataset.storeId;


    if (!storeId) {

      console.error(
        "점포 ID가 없습니다."
      );

      return;

    }


    /*
    점포 목록의 점포명은 전국/지역/달력 등 어느 화면에서 눌러도
    외부 공식 사이트가 아니라 현재 GitHub Pages의
    단일 점포 화면으로 연결합니다.

    단일 점포 화면 안의 "공식 점포 페이지" 버튼은
    requestedStoreId가 있으므로 기존처럼 외부 공식 URL로 이동합니다.
    */
    if (
      MART_CONFIG.allRegionsStoreLinksUseInternalView === true
      &&
      !requestedStoreId
    ) {

      window.location.href =
        buildInternalStoreViewUrl(
          storeId
        );

      return;

    }


    const store =
  holidayData.find(
    item =>
      getStoreId(item) ===
      String(storeId)
  );


const directDetailUrl =
  store
    ? getStoreDetailUrl(store)
    : "";


const officialUrl =
  directDetailUrl
  ||
  (
    MART_CONFIG.detailUrlBuilder
      ? MART_CONFIG.detailUrlBuilder(
          storeId
        )
      : (
          DETAIL_BASE_URL
            ? (
                DETAIL_BASE_URL
                +
                encodeURIComponent(
                  storeId
                )
              )
            : ""
        )
  );

if (!officialUrl) {

  console.error(
    "공식 점포 페이지 주소가 없습니다."
  );

  return;

}    

    window.location.href =
      officialUrl;

  }
);


/*
==================================================
보조 브랜드 데이터 읽기

예:
이마트 페이지에서 트레이더스 데이터를
별도 파일 구조는 유지한 채 함께 표시합니다.
==================================================
*/

async function loadSupplementalDataSources(
  cacheKey
) {

  const sources =
    Array.isArray(
      MART_CONFIG.supplementalDataSources
    )
      ? MART_CONFIG.supplementalDataSources
      : [];


  const supplementalItems = [];


  for (
    const source
    of sources
  ) {

    const candidates =
      [
        source?.archiveDataUrl,
        source?.currentDataUrl
      ]
        .filter(Boolean);


    let sourceData =
      null;


    for (
      const dataUrl
      of candidates
    ) {

      try {

        const response =
          await fetch(
            `${dataUrl}?time=` +
            cacheKey,
            {
              cache:
                "no-store"
            }
          );


        if (
          !response.ok
        ) {

          continue;

        }


        const payload =
          await response.json();


        if (
          Array.isArray(
            payload
          )
        ) {

          sourceData =
            payload;

          break;

        }

      } catch (
        sourceError
      ) {

        console.warn(
          "보조 점포 데이터를 불러오지 못했습니다.",
          dataUrl,
          sourceError
        );

      }

    }


    if (
      !Array.isArray(
        sourceData
      )
    ) {

      continue;

    }


    sourceData.forEach(
      item => {

        const originalId =
          getStoreId(
            item
          );


        const mappedItem = {
          ...item
        };


        if (
          source?.storeType
        ) {

          mappedItem.storeType =
            String(
              source.storeType
            );

        }


        if (
          source?.storeIdPrefix
          &&
          originalId
        ) {

          mappedItem.storeId =
            String(
              source.storeIdPrefix
            )
            +
            originalId;

        }


        supplementalItems.push(
          mappedItem
        );

      }
    );

  }


  return supplementalItems;

}


/*
==================================================
데이터 읽기

월 이동을 위해 holiday_archive.json을 우선 사용합니다.
파일이 없거나 오류가 나면 holidays.json으로 자동 대체합니다.
==================================================
*/

async function loadData() {

  document.title =
    `${MART_CONFIG.brandName || "마트"} 휴점일 안내`;

  const heading =
    document.getElementById("page-title");

  if (heading) {

    heading.textContent =
      `${MART_CONFIG.brandName || "마트"} 휴점일 안내`;

  }

  const source =
    document.getElementById("source-label");

  if (source) {

    source.textContent =
      `자료 출처 : ${MART_CONFIG.sourceLabel || "공식 홈페이지"}`;

  }


  try {

    const cacheKey =
      Date.now();


    const currentResponse =
      await fetch(
        `${MART_CONFIG.currentDataUrl}?time=` +
        cacheKey,
        {
          cache: "no-store"
        }
      );


    if (
      !currentResponse.ok
    ) {

      throw new Error(
        "holidays.json을 불러오지 못했습니다."
      );

    }


    const currentData =
      await currentResponse.json();


    /*
    변경 상태 파일은 없어도
    페이지 자체는 정상 작동해야 합니다.
    */
    changeStatusData =
      null;


    try {

      const changeStatusUrl =
        getChangeStatusUrl();


      if (changeStatusUrl) {

        const statusResponse =
          await fetch(
            `${changeStatusUrl}?time=` +
            cacheKey,
            {
              cache: "no-store"
            }
          );


        if (
          statusResponse.ok
        ) {

          changeStatusData =
            await statusResponse.json();

        }

      }

    } catch (
      statusError
    ) {

      console.warn(
        "change_status.json을 사용할 수 없습니다.",
        statusError
      );

    }


    let archiveData = null;


    try {

      const archiveResponse =
        await fetch(
          `${MART_CONFIG.archiveDataUrl}?time=` +
          cacheKey,
          {
            cache: "no-store"
          }
        );


      if (
        archiveResponse.ok
      ) {

        archiveData =
          await archiveResponse.json();

      }

    } catch (
      archiveError
    ) {

      console.warn(
        "holiday_archive.json을 사용할 수 없어 현재 달 데이터로 대체합니다.",
        archiveError
      );

    }


       if (
      Array.isArray(archiveData) &&
      archiveData.length > 0
    ) {

      holidayData =
        archiveData;

    } else {

      holidayData =
        currentData;

    }


    /*
    브랜드별 데이터 파일은 그대로 유지하면서
    현재 화면에서 함께 보여줄 보조 점포 데이터를 합칩니다.
    */
    const supplementalData =
      await loadSupplementalDataSources(
        cacheKey
      );


    if (
      supplementalData.length > 0
    ) {

      holidayData = [
        ...holidayData,
        ...supplementalData
      ];

    }


    /*
    date=YYYY-MM 요청값을
    실제 보관 데이터 범위에 맞춥니다.
    */
    normalizeSelectedMonthRange();


    /*
    최종 선택 월을 URL에 반영합니다.
    */
    updateDateInUrl();

    /*
    자료 출처와 최근 확인 정보를 표시
    */
    updateSourceStatus();


    if (
      requestedStoreId
    ) {

      const store =
        holidayData.find(
          item =>
            getStoreId(item) ===
            String(requestedStoreId)
        );


      if (store) {

        renderSingleStore(
          store
        );

        return;

      }


      document
        .getElementById(
          "tabs"
        )
        .style.display =
          "none";


      document
        .getElementById(
          "content"
        )
        .innerHTML = `
          <div class="error">
            해당 점포를 찾을 수 없습니다.
          </div>
        `;


      return;

    }


    if (
      selectedSpecialType
      &&
      !holidayData.some(
        item =>
          getStoreType(item) ===
          selectedSpecialType
      )
    ) {

      selectedSpecialType =
        null;

    }


    createTabs();


    if (
      selectedSpecialType
    ) {

      renderSpecialType();

      return;

    }


    if (
      selectedRegion === "all"
    ) {

      renderAllRegions();

      return;

    }


    renderRegion();


  } catch (error) {

    document
      .getElementById(
        "content"
      )
      .innerHTML = `
        <div class="error">
          휴점일 데이터를 불러오는 중 오류가 발생했습니다.
        </div>
      `;


    console.error(
      error
    );

  }

}


loadData();
