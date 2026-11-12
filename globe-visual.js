/*
  SOUND SPHERE
  تطوير الكرة الأرضية والتمثيل البصري للمؤشر العالمي.

  ترتيب التحميل:
  1. assets/three.offline.js
  2. globe-visual.js
  3. app.js

  يستخدم الملفات المحلية الموجودة.
  لا يغيّر الأصوات أو بيانات NASA.
*/

(function () {
  "use strict";

  const stage = document.getElementById("climateStage");

  const world = stage
    ? stage.querySelector(".stage-world")
    : null;

  const host = document.getElementById("globe");

  if (!stage || !world || !host) {
    return;
  }

  document.body.classList.add("sphere-enhanced");

  host.tabIndex = 0;

  host.setAttribute(
    "aria-keyshortcuts",
    "ArrowLeft ArrowRight"
  );

  host.title =
    "اسحب لتدوير الكرة، أو استخدم السهمين الأيمن والأيسر";

  /* إنشاء طبقة التموجات */

  const SVG_NS = "http://www.w3.org/2000/svg";

  const field = document.createElementNS(
    SVG_NS,
    "svg"
  );

  field.classList.add("sphere-wavefield");
  field.setAttribute("aria-hidden", "true");

  world.prepend(field);

  const waves = Array.from(
    { length: 7 },
    function () {
      const ellipse = document.createElementNS(
        SVG_NS,
        "ellipse"
      );

      ellipse.setAttribute("fill", "none");

      ellipse.setAttribute(
        "vector-effect",
        "non-scaling-stroke"
      );

      field.appendChild(ellipse);

      return ellipse;
    }
  );

  /* إرشاد التفاعل */

  const hint = document.createElement("p");

  hint.className = "sphere-hint";
  hint.textContent = "اسحب لتدوير الأرض";

  world.appendChild(hint);

  /* شريط مدة النغمة */

  const meter = document.createElement("div");

  meter.className = "sphere-progress";
  meter.setAttribute("aria-hidden", "true");
  meter.innerHTML = "<span></span>";

  world.appendChild(meter);

  /* إعدادات الحركة */

  const motionInput = document.getElementById("motion");

  const motionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  function reducedMotion() {
    return motionInput
      ? motionInput.checked
      : motionQuery.matches;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(
      minimum,
      Math.min(maximum, value)
    );
  }

  let width = 1;
  let height = 1;

  let sounding = false;
  let startedAt = 0;

  let amount = 0;
  let strength = 0;

  let lastFrame = performance.now();

  let dragOffset = 0;
  let drag = null;

  const DURATION = 8000;

  /* ملاءمة التموجات لمساحة العرض */

  function resize() {
    width = Math.max(1, world.clientWidth);
    height = Math.max(1, world.clientHeight);

    field.setAttribute(
      "viewBox",
      "0 0 " + width + " " + height
    );
  }

  const sizeObserver = new ResizeObserver(resize);

  sizeObserver.observe(world);

  resize();

  /*
    قراءة مقدار المؤشر البصري الذي يحدّثه app.js.

    التطبيق الحالي يكتب --heat-color اعتمادًا على
    المؤشر الحراري العالمي نفسه المستخدم للصوت.

    لا نستخرج منه درجة حرارة رقمية،
    ولا ننسب قيمًا إلى الدول أو المناطق.
  */

  function readAmount() {
    const color = stage.style.getPropertyValue(
      "--heat-color"
    );

    const rgb = color.match(/[\d.]+/g);

    if (!rgb) {
      return 0;
    }

    return clamp(
      (Number(rgb[0]) - 108) / 133,
      0,
      1
    );
  }

  /* ربط التموجات بتشغيل النغمة */

  const audioObserver = new MutationObserver(
    function (records) {
      const nowPlaying =
        stage.dataset.sounding === "true";

      const restarted = records.some(
        function (record) {
          return (
            record.attributeName === "data-sounding" &&
            record.oldValue === "false" &&
            nowPlaying
          );
        }
      );

      if (
        nowPlaying &&
        (!sounding || restarted)
      ) {
        startedAt = performance.now();
      }

      sounding = nowPlaying;

      stage.dataset.visualState = sounding
        ? "playing"
        : "idle";
    }
  );

  audioObserver.observe(stage, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-sounding"]
  });

  /* تدوير الكرة بالسحب */

  host.addEventListener(
    "pointerdown",
    function (event) {
      if (
        event.pointerType === "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      drag = {
        x: event.clientX,
        y: event.clientY,
        moved: false
      };
    }
  );

  host.addEventListener(
    "pointermove",
    function (event) {
      if (!drag) {
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;

      if (
        !drag.moved &&
        Math.abs(dx) < 5
      ) {
        return;
      }

      /*
        السماح بالتمرير العمودي على الهاتف
        قبل بدء سحب أفقي فعلي.
      */
      if (
        !drag.moved &&
        Math.abs(dy) > Math.abs(dx)
      ) {
        drag = null;
        return;
      }

      drag.moved = true;

      if (
        !host.hasPointerCapture(event.pointerId)
      ) {
        host.setPointerCapture(event.pointerId);
      }

      dragOffset += dx * 0.006;

      drag.x = event.clientX;
      drag.y = event.clientY;
    }
  );

  function release() {
    drag = null;
  }

  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);
  host.addEventListener("lostpointercapture", release);

  /* تدوير الكرة بلوحة المفاتيح */

  host.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }

      event.preventDefault();

      dragOffset +=
        event.key === "ArrowLeft"
          ? -0.13
          : 0.13;
    }
  );

  /* رسم التموجات */

  function draw(now) {
    const dt = clamp(
      (now - lastFrame) / 1000,
      0,
      0.05
    );

    lastFrame = now;

    const reduced = reducedMotion();

    const ease = reduced
      ? 1
      : 1 - Math.exp(-dt * 2.2);

    amount +=
      (readAmount() - amount) * ease;

    strength +=
      ((sounding ? 1 : 0) - strength) * ease;

    const progress = sounding
      ? clamp(
          (now - startedAt) / DURATION,
          0,
          1
        )
      : 0;

    /*
      المؤشر الأعلى يُظهر تموجات أكثر.
      ظهور التموجات تدريجي، دون ومضات سريعة.
    */
    const visibleCount = 2 + amount * 4;

    const cx = width * 0.5;
    const cy = height * 0.5;

    const radius = Math.min(
      height * 0.43,
      width * 0.34
    );

    const spread = reduced
      ? 0.035
      : Math.sin(progress * Math.PI) * 0.07;

    /*
      اللون مساعدة إضافية فقط.
      عدد التموجات يتغير أيضًا،
      بينما يبقى سطح الأرض جغرافيًا واضحًا.
    */
    const cold = [133, 190, 218];
    const warm = [224, 182, 131];

    const color = cold.map(
      function (value, index) {
        return Math.round(
          value +
          (warm[index] - value) * amount
        );
      }
    );

    for (
      let index = 0;
      index < waves.length;
      index++
    ) {
      const visibility = clamp(
        visibleCount - index,
        0,
        1
      );

      const rx = radius * (
        1.08 +
        index * 0.07 +
        spread
      );

      const wave = waves[index];

      wave.setAttribute("cx", cx);
      wave.setAttribute("cy", cy);

      wave.setAttribute("rx", rx);
      wave.setAttribute("ry", rx * 0.37);

      wave.setAttribute(
        "transform",
        "rotate(-18 " + cx + " " + cy + ")"
      );

      wave.setAttribute(
        "stroke",
        "rgb(" + color.join(",") + ")"
      );

      wave.setAttribute(
        "stroke-width",
        index === 0 ? "1.4" : "0.85"
      );

      wave.setAttribute(
        "opacity",
        visibility * (
          0.14 +
          strength * 0.5
        )
      );
    }

    meter.style.setProperty(
      "--progress",
      progress
    );

    /*
      بديل الكرة عند عدم توفر WebGL:
      السحب يغيّر موضع صورة السطح.
    */
    const fallback = host.querySelector(
      ".globe-fallback"
    );

    if (fallback) {
      fallback.style.backgroundPosition =
        (50 + dragOffset * 15) + "% center";
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);

  /*
    تطوير العارض الحالي بدل إنشاء كرة ثانية.

    نعيد استخدام:
    - صورة الأرض الأصلية.
    - المشهد الحالي.
    - المحرك الموجود في المشروع.
  */

  const THREE = window.THREE;

  if (
    !THREE ||
    !THREE.WebGLRenderer
  ) {
    return;
  }

  const BaseRenderer = THREE.WebGLRenderer;

  class SphereRenderer extends BaseRenderer {
    constructor(options) {
      super(options);

      this.sphereState = null;
    }

    render(scene, camera) {
      if (!this.sphereState) {
        const earth = scene.children.find(
          function (object) {
            return (
              object.isMesh &&
              object.material &&
              object.material.map
            );
          }
        );

        if (earth) {
          const atmosphere = scene.children.find(
            function (object) {
              return (
                object.isMesh &&
                object !== earth
              );
            }
          );

          this.sphereState = {
            earth: earth,
            atmosphere: atmosphere,
            angle: earth.rotation.y - dragOffset,
            lastTime: performance.now()
          };

          earth.material.shininess = 14;

          earth.material.specular.set(
            "#284654"
          );

          /* إضاءة طبيعية مع جانب مضاء وآخر مظلل */
          scene.children.forEach(
            function (object) {
              if (object.isAmbientLight) {
                object.color.set("#dceaf1");
                object.intensity = 1.1;
              }

              if (object.isDirectionalLight) {
                object.color.set("#fff3dd");
                object.intensity = 2.2;

                object.position.set(
                  -3.5,
                  2.4,
                  5
                );
              }
            }
          );
        }
      }

      const state = this.sphereState;

      if (state) {
        const now = performance.now();

        const dt = clamp(
          (now - state.lastTime) / 1000,
          0,
          0.05
        );

        state.lastTime = now;

        const experience = document.getElementById(
          "experience"
        );

        const inExperience =
          experience && !experience.hidden;

        /*
          دوران بطيء:
          - في الصفحة الرئيسية.
          - أثناء تشغيل النغمة.
          - يتوقف تلقائيًا عند تقليل الحركة.
        */
        if (
          !reducedMotion() &&
          !drag &&
          (!inExperience || sounding)
        ) {
          state.angle += dt * (
            inExperience ? 0.045 : 0.025
          );
        }

        state.earth.rotation.y =
          state.angle + dragOffset;

        /*
          يبقى سطح الأرض بلونه الطبيعي.
          المؤشر يُعرض في التموجات المحيطة.
        */
        state.earth.material.emissive.set(
          "#031821"
        );

        state.earth.material.emissiveIntensity =
          0.08;

        if (state.atmosphere) {
          state.atmosphere.material.color.set(
            "#a3d7e2"
          );

          state.atmosphere.material.opacity =
            0.12;

          state.atmosphere.scale.setScalar(
            1.008
          );
        }

        /* ملاءمة الكاميرا لمنع صغر الكرة أو اقتطاعها */
        const w = host.clientWidth;
        const h = host.clientHeight;

        if (w > 0 && h > 0) {
          const aspect = w / h;

          if (
            camera.fov !== 34 ||
            camera.aspect !== aspect
          ) {
            camera.fov = 34;
            camera.aspect = aspect;

            camera.updateProjectionMatrix();
          }

          const halfFov = Math.atan(
            Math.tan(
              17 * Math.PI / 180
            ) * Math.min(1, aspect)
          );

          camera.position.z =
            1.18 /
            Math.sin(halfFov) *
            1.12;
        }
      }

      return super.render(scene, camera);
    }
  }

  THREE.WebGLRenderer = SphereRenderer;
})();