import React from 'react';
import { Link } from 'react-router-dom';
import { FaMagic, FaBook, FaLightbulb, FaRocket } from 'react-icons/fa';
import { motion } from 'framer-motion';
import './Home.css';

const Home = () => {
  const features = [
    {
      icon: <FaMagic />,
      title: 'AI Генерація',
      description: 'Штучний інтелект створює унікальні історії на основі ваших параметрів'
    },
    {
      icon: <FaBook />,
      title: 'Нелінійний сюжет',
      description: 'Кожен ваш вибір впливає на розвиток історії та її кінцівку'
    },
    {
      icon: <FaLightbulb />,
      title: 'Різні жанри',
      description: 'Фентезі, фантастика, детектив, жахи та багато інших жанрів'
    },
    {
      icon: <FaRocket />,
      title: 'Безмежні можливості',
      description: 'Створюйте та проходьте необмежену кількість унікальних історій'
    }
  ];

  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="hero-title">
              Створюйте свої <span className="gradient-text">унікальні</span> історії з AI
            </h1>
            <p className="hero-subtitle">
              Інтерактивна платформа, де штучний інтелект генерує захоплюючі сюжети, 
              а ви обираєте свій шлях у кожній історії
            </p>
            <div className="hero-buttons">
              <Link to="/generator" className="btn btn-primary">
                <FaMagic />
                Почати створювати
              </Link>
              <Link to="/library" className="btn btn-secondary">
                <FaBook />
                Переглянути бібліотеку
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Чому AI Fiction?
          </motion.h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <motion.div
            className="cta-content"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2>Готові розпочати свою пригоду?</h2>
            <p>Створіть свою першу інтерактивну історію прямо зараз</p>
            <Link to="/generator" className="btn btn-cta">
              <FaRocket />
              Створити історію
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
