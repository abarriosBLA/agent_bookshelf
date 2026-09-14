-- Seed data for Agent Bookshelf
-- ~50 books, 3 users, shelves, and reviews

-- Users
INSERT INTO users (username, display_name) VALUES ('alice', 'Alice Chen');
INSERT INTO users (username, display_name) VALUES ('bob', 'Bob Martinez');
INSERT INTO users (username, display_name) VALUES ('carol', 'Carol Okafor');

-- Books (50 titles across genres)
INSERT INTO books (title, author, isbn, cover_url, description, published_year) VALUES
('The Pragmatic Programmer', 'Andrew Hunt and David Thomas', '978-0201616224', NULL, 'A journeyman programmer''s guide to coding craft and career development.', 1999),
('Clean Code', 'Robert C. Martin', '978-0132350884', NULL, 'A handbook of agile software craftsmanship covering naming, functions, and code quality.', 2008),
('Design Patterns', 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides', '978-0201633610', NULL, 'Elements of reusable object-oriented software. The Gang of Four classic.', 1994),
('Refactoring', 'Martin Fowler', '978-0134757599', NULL, 'Improving the design of existing code through systematic techniques.', 2018),
('The Mythical Man-Month', 'Frederick P. Brooks Jr.', '978-0201835953', NULL, 'Essays on software engineering and project management from a legendary architect.', 1975),
('Introduction to Algorithms', 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein', '978-0262033848', NULL, 'Comprehensive textbook on algorithms and data structures. Known as CLRS.', 2009),
('Structure and Interpretation of Computer Programs', 'Harold Abelson and Gerald Jay Sussman', '978-0262510875', NULL, 'A foundational text on computer science using Scheme. Known as SICP.', 1996),
('The Art of Computer Programming', 'Donald E. Knuth', '978-0201896831', NULL, 'Monumental multi-volume work on fundamental algorithms. Knuth''s magnum opus.', 1968),
('Cracking the Coding Interview', 'Gayle Laakmann McDowell', '978-0984782857', NULL, '189 programming questions and solutions for technical interview preparation.', 2015),
('The Phoenix Project', 'Gene Kim, Kevin Behr, and George Spafford', '978-0988262508', NULL, 'A novel about IT, DevOps, and helping your business win through DevOps practices.', 2013),
('The DevOps Handbook', 'Gene Kim, Patrick Debois, John Willis, Jez Humble', '978-1942788003', NULL, 'How to create world-class agility, reliability, and security in technology organizations.', 2016),
('Accelerate', 'Nicole Forsgren, Jez Humble, and Gene Kim', '978-1942788331', NULL, 'The science of lean software and DevOps based on four years of research.', 2018),
('Site Reliability Engineering', 'Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Richard Murphy', '978-1491929124', NULL, 'How Google runs production systems. The SRE bible.', 2016),
('The Goal', 'Eliyahu M. Goldratt and Jeff Cox', '978-0884271956', NULL, 'A process of ongoing improvement told as a business novel. Theory of Constraints.', 1984),
('Thinking in Systems', 'Donella H. Meadows', '978-1603580557', NULL, 'A primer on systems thinking and understanding complex systems.', 2008),
('Dune', 'Frank Herbert', '978-0441013593', NULL, 'A science fiction masterpiece set on the desert planet Arrakis. Politics, religion, ecology.', 1965),
('Neuromancer', 'William Gibson', '978-0441569595', NULL, 'The cyberpunk classic that coined the term "cyberspace" and defined a genre.', 1984),
('Snow Crash', 'Neal Stephenson', '978-0553380958', NULL, 'A cyberpunk novel about a pizza delivery driver who is also a hacker and swordsman.', 1992),
('The Left Hand of Darkness', 'Ursula K. Le Guin', '978-0441478125', NULL, 'A groundbreaking science fiction novel exploring gender and society on an alien world.', 1969),
('Foundation', 'Isaac Asimov', '978-0553293357', NULL, 'The first book in the Foundation series about the fall and rise of galactic civilization.', 1951),
('Ender''s Game', 'Orson Scott Card', '978-0812550702', NULL, 'A child prodigy is trained to lead humanity''s forces against an alien threat.', 1985),
('The Hitchhiker''s Guide to the Galaxy', 'Douglas Adams', '978-0345391803', NULL, 'A comedic science fiction series about the misadventures of Arthur Dent.', 1979),
('1984', 'George Orwell', '978-0451524935', NULL, 'A dystopian novel about totalitarianism, surveillance, and thought control.', 1949),
('Brave New World', 'Aldous Huxley', '978-0060850524', NULL, 'A dystopian vision of a future society engineered for happiness and stability.', 1932),
('Fahrenheit 451', 'Ray Bradbury', '978-1451673319', NULL, 'A dystopian novel about a future American society where books are banned and burned.', 1953),
('The Martian', 'Andy Weir', '978-0553418026', NULL, 'An astronaut stranded on Mars must use his ingenuity to survive.', 2011),
('Project Hail Mary', 'Andy Weir', '978-0593135204', NULL, 'A lone astronaut must save humanity from an extinction-level threat.', 2021),
('The Three-Body Problem', 'Liu Cixin', '978-0765382030', NULL, 'First contact with an alien civilization during China''s Cultural Revolution.', 2008),
('The Expanse: Leviathan Wakes', 'James S.A. Corey', '978-0316129084', NULL, 'A detective and a ice hauler uncover a conspiracy that threatens the solar system.', 2011),
('Hyperion', 'Dan Simmons', '978-0553283686', NULL, 'Seven pilgrims travel to the Time Tombs of Hyperion, each with their own story.', 1989),
('The Hobbit', 'J.R.R. Tolkien', '978-0547928227', NULL, 'A hobbit''s unexpected journey with dwarves to reclaim their treasure from a dragon.', 1937),
('The Lord of the Rings', 'J.R.R. Tolkien', '978-0544003415', NULL, 'An epic high-fantasy novel about the quest to destroy the One Ring.', 1954),
('A Game of Thrones', 'George R.R. Martin', '978-0553103540', NULL, 'Noble families vie for control of the Iron Throne in a world of magic and dragons.', 1996),
('The Name of the Wind', 'Patrick Rothfuss', '978-0756404741', NULL, 'A legendary wizard tells the story of his life from orphan to archmage.', 2007),
('The Way of Kings', 'Brandon Sanderson', '978-0765326355', NULL, 'Epic fantasy on a world of storms, magic, and ancient mysteries.', 2010),
('Mistborn: The Final Empire', 'Brandon Sanderson', '978-0765311788', NULL, 'A thief leads a rebellion against an immortal emperor in a world of ash.', 2006),
('The Fifth Season', 'N.K. Jemisin', '978-0316229296', NULL, 'A world of constant geological catastrophe and people who can control earthquakes.', 2015),
('The Poppy War', 'R.F. Kuang', '978-0062662583', NULL, 'A shaman rises through the ranks of a military academy during a brutal war.', 2018),
('Piranesi', 'Susanna Clarke', '978-1635575637', NULL, 'A man lives in an infinite house of halls and statues, slowly discovering the truth.', 2020),
('The City & the City', 'China Miéville', '978-0345497512', NULL, 'A detective investigates a murder in two overlapping cities that citizens must ignore.', 2009),
('Annihilation', 'Jeff VanderMeer', '978-0374104092', NULL, 'A team of women explores a mysterious zone where the rules of nature have broken down.', 2014),
('The Murderbot Diaries: All Systems Red', 'Martha Wells', '978-1250185563', NULL, 'A security android that calls itself Murderbot just wants to watch soap operas.', 2017),
('Children of Time', 'Adrian Tchaikovsky', '978-0316275842', NULL, 'The last remnants of humanity find a terraformed world where evolution took a different path.', 2015),
('Klara and the Sun', 'Kazuo Ishiguro', '978-0571364886', NULL, 'An Artificial Friend observes humans and contemplates what it means to love.', 2021),
('The Dispossessed', 'Ursula K. Le Guin', '978-0061054877', NULL, 'A physicist travels between two worlds with opposing political systems.', 1974),
('A Fire Upon the Deep', 'Vernor Vinge', '978-0812515282', NULL, 'A group flees across the galaxy with a dangerous entity that could destroy civilization.', 1992),
('Old Man''s War', 'John Scalzi', '978-0765348272', NULL, 'Elderly men are recruited to fight in an interstellar war in young, enhanced bodies.', 2005),
('The Long Way to a Small, Angry Planet', 'Becky Chambers', '978-1473619784', NULL, 'A human joins the crew of a tunnel-building ship traveling to distant worlds.', 2014),
('A Memory Called Empire', 'Arkady Martine', '978-1250186430', NULL, 'An ambassador from a small station must navigate the politics of a vast empire.', 2019),
('To Sleep in a Sea of Stars', 'Christopher Paolini', '978-1250252838', NULL, 'A xenobiologist discovers alien technology that changes humanity''s place in the universe.', 2020);

-- Shelves for each user
-- Alice's shelves
INSERT INTO shelves (user_id, name) VALUES (1, 'want-to-read');
INSERT INTO shelves (user_id, name) VALUES (1, 'currently-reading');
INSERT INTO shelves (user_id, name) VALUES (1, 'read');

-- Bob's shelves
INSERT INTO shelves (user_id, name) VALUES (2, 'want-to-read');
INSERT INTO shelves (user_id, name) VALUES (2, 'currently-reading');
INSERT INTO shelves (user_id, name) VALUES (2, 'read');

-- Carol's shelves
INSERT INTO shelves (user_id, name) VALUES (3, 'want-to-read');
INSERT INTO shelves (user_id, name) VALUES (3, 'currently-reading');
INSERT INTO shelves (user_id, name) VALUES (3, 'read');

-- Shelf books (assigning books to shelves)
-- Alice: has read some classics, currently reading sci-fi
INSERT INTO shelf_books (shelf_id, book_id) VALUES (3, 1);  -- Pragmatic Programmer (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (3, 2);  -- Clean Code (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (3, 16); -- Dune (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (2, 28); -- Three-Body Problem (currently reading)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (1, 31); -- Hobbit (want to read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (1, 32); -- Lord of the Rings (want to read)

-- Bob: tech-heavy reader
INSERT INTO shelf_books (shelf_id, book_id) VALUES (6, 1);  -- Pragmatic Programmer (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (6, 3);  -- Design Patterns (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (6, 4);  -- Refactoring (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (6, 11); -- DevOps Handbook (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (5, 13); -- SRE book (currently reading)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (4, 12); -- Accelerate (want to read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (4, 14); -- The Goal (want to read)

-- Carol: sci-fi enthusiast
INSERT INTO shelf_books (shelf_id, book_id) VALUES (9, 16); -- Dune (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (9, 17); -- Neuromancer (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (9, 22); -- Hitchhiker''s Guide (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (9, 26); -- The Martian (read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (8, 42); -- Murderbot Diaries (currently reading)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (7, 43); -- Children of Time (want to read)
INSERT INTO shelf_books (shelf_id, book_id) VALUES (7, 44); -- Klara and the Sun (want to read)

-- Reviews
-- Alice's reviews
INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES
(1, 1, 5, 'Essential reading for any developer. The advice on career development is as valuable as the technical content.'),
(1, 2, 4, 'Solid principles but some examples feel dated. The naming chapters alone are worth the read.'),
(1, 16, 5, 'A masterpiece of world-building. Herbert created something truly unique with the ecology and politics of Arrakis.');

-- Bob's reviews
INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES
(2, 1, 4, 'Good foundations but wish there were more modern examples. Still a classic for a reason.'),
(2, 3, 5, 'The Gang of Four delivered. Every pattern is explained with clarity and real-world applicability.'),
(2, 4, 5, 'Fowler makes refactoring feel approachable. The code examples show clear before/after transformations.'),
(2, 11, 4, 'Practical guide to DevOps transformation. Some chapters on culture are more valuable than the technical ones.');

-- Carol's reviews
INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES
(3, 16, 5, 'Re-reading this every few years. The prescience about ecology and resource politics is stunning.'),
(3, 17, 5, 'Gibson invented cyberpunk with this book. The prose is dense but the vision is unmatched.'),
(3, 22, 4, 'Hilarious and surprisingly philosophical. "Don''t Panic" is life advice.'),
(3, 26, 4, 'A love letter to problem-solving. Weir makes science feel accessible and exciting.');
