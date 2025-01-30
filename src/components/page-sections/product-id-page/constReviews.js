// @/components/page-sections/productid-page/constReviews.js

const randomIndianNames = [
  "Aarav Mehta",
  "Kabir Singh",
  "Rahul Jain",
  "Aisha Khan",
  "Rohan Sharma",
  "Sania Patel",
  "Vikram Singh",
  "Neha Rao",
  "Rajat Pandey",
  "Siddharth Saxena",
  "Arnav Agarwal",
  "Kavya Singh",
  "Raghav Malhotra",
  "Srishti Rao",
  "Aditya Verma",
  "Akshara Singh",
  "Rohan Bhat",
  "Sneha Joshi",
  "Rajeev Agarwal",
  "Swaroop Mishra",
];

const numberOfReviews = 13;
export const constReviews = Array.from({ length: numberOfReviews }).map((_, i) => ({
    id: i + 1,
    rating: Math.floor(Math.random() * 3) + 3,
    comment: ["", "", "", "", ""][Math.floor(Math.random() * 5)] + ["Good product", "Excellent quality", "Best helmet", "Great product", "Awesome"][Math.floor(Math.random() * 5)],
    date: (new Date(Date.now() - (Math.floor(Math.random() * 10000000) * 1000))).toLocaleDateString("en-GB"),
    image: "/images/metadata/logoforlink.png",
    name: randomIndianNames[Math.floor(Math.random() * randomIndianNames.length)],
}));
