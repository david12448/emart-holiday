/*
==================================================
기본 설정
==================================================
*/

const MART_CONFIG =
  window.MART_CONFIG || {};


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
?region=all
또는
?region=전체

→ 지역 탭을 숨기고 전국 점포를 한 화면에 표시
*/
const isAllRegions =
  requestedRegion === "all" ||
  requestedRegion === "전체";


const requestedStoreId =
  urlParams.get("storeId");


let selectedRegion =
  regionOrder.includes(requestedRegion)
    ? requestedRegion
    : "서울";


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
  koreaToday.getFullYear();


let selectedMonth =
  koreaToday.getMonth() + 1;


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
    Object.keys(holidayCount)
      .sort();


  if (dates.length === 0) {

    return `
      <div class="calendar-quick-summary">
        <span class="calendar-summary-label">휴무</span>
        등록된 휴무일이 없습니다.
      </div>
    `;

  }


  const summary =
    dates
      .map(
        date => {

          return formatDate(date);

        }
      )
      .join(" · ");


  return `
    <div class="calendar-quick-summary">
      <span class="calendar-summary-label">휴무</span>
      <span>${summary}</span>
    </div>
  `;

}



/*
==================================================
점포명을 클릭하면 공식 점포 페이지로 이동한다는 안내
==================================================
*/

function buildStoreClickGuide() {

  return `
    <div class="store-click-guide">
      <span class="store-click-guide-icon">i</span>

      <span>
        점포별 영업시간·전화번호 등 자세한 정보는
        <strong>아래 점포명을 클릭해 확인할 수 있습니다.</strong>
        ${MART_CONFIG.officialPageLabel || "공식 점포 페이지"}가 새 탭에서 열립니다.
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

  const holidayCount = {};


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

            if (!holidayCount[date]) {
              holidayCount[date] = 0;
            }

            holidayCount[date]++;

          }
        );

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


    const count =
      holidayCount[dateKey] || 0;


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


    html += `
      <div
        class="
          calendar-day
          ${weekdayClass}
          ${isClosed ? "closed" : ""}
          ${isClosed && isPast ? "past-closed" : ""}
          ${isToday ? "today" : ""}
        "
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

      <div class="calendar-legend">
        색상이 표시된 날짜는 휴무일이며,
        지난 휴무일은 연하게 표시됩니다.
      </div>

    </div>
  `;


  return html;

}


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
                  String(store.id),
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
                target="_blank"
                rel="noopener noreferrer"
                data-store-id="${store.id}"
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
  실제로 이 브랜드의 점포가 존재하는 지역만 표시합니다.

  예:
  트레이더스에 세종 점포가 없으면
  세종 탭은 자동으로 생성되지 않습니다.
  */
  const availableRegions =
    regionOrder.filter(
      region =>
        holidayData.some(
          item =>
            item.region === region
        )
    );


  /*
  URL로 지정한 지역이 없거나,
  해당 브랜드에 존재하지 않는 지역이면
  실제 존재하는 첫 번째 지역을 기본 선택합니다.
  */
  if (
    !availableRegions.includes(
      selectedRegion
    ) &&
    availableRegions.length > 0
  ) {

    selectedRegion =
      availableRegions[0];

  }


  availableRegions.forEach(
    region => {

      const button =
        document.createElement(
          "button"
        );


      button.className =
        "tab-button";


      if (
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

          selectedRegion =
            region;


          createTabs();

          renderRegion();

        }
      );


      tabs.appendChild(
        button
      );

    }
  );

}


/*
==================================================
개별 점포 화면
==================================================
*/

function renderSingleStore(store) {

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

    <h2 class="region-title">

      ${displayName}

      <span class="region-count">
        · ${store.region}
      </span>

    </h2>
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
            target="_blank"
            rel="noopener noreferrer"
            data-store-id="${store.id}"
            title="${displayName} 상세정보 보기"
          >

            <span class="store-detail-text">

              <span>
                ${displayName} 점포 상세정보 보기
              </span>

              <span class="store-detail-sub">
                ${MART_CONFIG.officialPageLabel || "공식 점포 페이지"}
              </span>

            </span>

            <span class="store-detail-arrow">
              →
            </span>

          </a>

        </div>

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
              String(
                item.store.id
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
                      ? `${displayName} · ${store.region}`
                      : displayName;


                  html += `
                    <a
                      class="store-grid-item store-link"
                      href="${TISTORY_POST_URL}"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-store-id="${store.id}"
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
지역 화면
==================================================
*/

function renderRegion() {

  const stores =
    holidayData.filter(
      item =>
        item.region ===
        selectedRegion
    );


  renderStoreCollection(
    stores,
    `${selectedRegion} 지역`,
    `${selectedRegion} 지역의 ${MART_CONFIG.brandName || "마트"} 휴무일을 확인할 수 있습니다.`,
    false
  );

}


/*
==================================================
전국 전체 점포 화면

주소:
?region=all
==================================================
*/

function renderAllRegions() {

  const tabs =
    document.getElementById(
      "tabs"
    );


  tabs.style.display =
    "none";


  renderStoreCollection(
    holidayData,
    "전국",
    `전국의 ${MART_CONFIG.brandName || "마트"} 휴무일을 한 화면에서 확인할 수 있습니다.`,
    true
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
          String(item.id) ===
          String(requestedStoreId)
      );


    if (store) {

      renderSingleStore(
        store
      );

    }

    return;

  }


  if (
    isAllRegions
  ) {

    renderAllRegions();

    return;

  }


  createTabs();

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


    const officialUrl =
      MART_CONFIG.detailUrlBuilder
        ? MART_CONFIG.detailUrlBuilder(storeId)
        : (
            DETAIL_BASE_URL
            +
            encodeURIComponent(
              storeId
            )
          );


    window.open(
      officialUrl,
      "_blank",
      "noopener"
    );

  }
);


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


    if (
      requestedStoreId
    ) {

      const store =
        holidayData.find(
          item =>
            String(item.id) ===
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
      isAllRegions
    ) {

      renderAllRegions();

      return;

    }


    createTabs();

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
