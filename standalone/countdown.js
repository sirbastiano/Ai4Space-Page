const launchDate = new Date('May 30, 2025 23:59:59').getTime();

const countdown = function () {
  const presentDate = new Date().getTime();

  if (presentDate < launchDate) {
    const diffInSeconds = Math.floor((launchDate - presentDate) / 1000);

    const days = Math.floor(diffInSeconds / 86400);

    let hours, minutes, seconds;
    let timeValue;

    // Hours
    timeValue = diffInSeconds % 86400;
    hours = Math.floor(timeValue / 3600);

    // Minutes
    timeValue = timeValue % 3600;
    minutes = Math.floor(timeValue / 60);
    
    // Seconds
    seconds = timeValue % 60;

    document.querySelector('.days').textContent = zeroPadding(days);
    document.querySelector('.hours').textContent = zeroPadding(hours);
    document.querySelector('.minutes').textContent = zeroPadding(minutes);
    document.querySelector('.seconds').textContent = zeroPadding(seconds);
  } else {
    document.querySelector('.days').textContent = zeroPadding(0);
    document.querySelector('.hours').textContent = zeroPadding(0);
    document.querySelector('.minutes').textContent = zeroPadding(0);
    document.querySelector('.seconds').textContent = zeroPadding(0);
    // Optionally, update a caption or message when the countdown ends
    // document.querySelector('.caption').textContent = 'Submissions Closed'; 
  }
};

function zeroPadding(time) {
  return time < 10 ? '0' + String(time) : time;
}

setInterval(countdown, 1000);
// Initialize countdown on page load
document.addEventListener("DOMContentLoaded", countdown);
