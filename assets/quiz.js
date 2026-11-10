// quiz.js — reusable multiple-choice widget with immediate feedback.
//
// Markup:
//   <div class="quiz">
//     <div class="quiz-q" data-answer="1" data-explain="...">
//       <p class="q-text">Question?</p>
//       <div class="opts">
//         <button class="opt" type="button">Option</button>  <!-- repeated -->
//       </div>
//     </div>
//   </div>
//
// data-answer is the zero-based index of the correct option.
// Feedback appears immediately; the question locks after the first answer.

(function () {
	"use strict";

	function initQuiz(quiz) {
		var questions = Array.prototype.slice.call(quiz.querySelectorAll(".quiz-q"));
		if (!questions.length) return;

		var answered = 0;
		var correct = 0;

		var score = document.createElement("p");
		score.className = "quiz-score";
		score.textContent = "0 / " + questions.length + " benar";
		quiz.appendChild(score);

		questions.forEach(function (q) {
			var answerIndex = parseInt(q.getAttribute("data-answer"), 10);
			var explanation = q.getAttribute("data-explain") || "";
			var options = Array.prototype.slice.call(q.querySelectorAll(".opt"));

			options.forEach(function (opt, index) {
				opt.addEventListener("click", function () {
					if (q.dataset.done) return;
					q.dataset.done = "1";
					answered += 1;

					var isCorrect = index === answerIndex;
					if (isCorrect) correct += 1;

					options.forEach(function (o, i) {
						o.disabled = true;
						if (i === answerIndex) o.classList.add("correct");
						else if (i === index) o.classList.add("wrong");
						else o.classList.add("faded");
					});

					var fb = document.createElement("p");
					fb.className = "feedback " + (isCorrect ? "ok" : "bad");
					fb.setAttribute("role", "status");
					fb.textContent = (isCorrect ? "Benar. " : "Belum tepat. ") + explanation;
					q.appendChild(fb);

					score.textContent = correct + " / " + questions.length + " benar";
					if (answered === questions.length) {
						score.textContent =
							correct + " / " + questions.length + " benar" +
							(correct === questions.length
								? " — semua tepat."
								: " — baca ulang bagian yang meleset, lalu lanjut.");
					}
				});
			});
		});
	}

	document.addEventListener("DOMContentLoaded", function () {
		Array.prototype.forEach.call(document.querySelectorAll(".quiz"), initQuiz);
	});
})();
