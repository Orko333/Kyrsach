import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaSpinner, FaHome, FaTrash, FaDownload, FaProjectDiagram } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import api, { storyAPI, aiAPI } from '../../services/api';
import { BackgroundContext } from '../../contexts/BackgroundContext';
import { useProgress } from '../../contexts/ProgressContext';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import StoryTree from '../../components/StoryTree/StoryTree';
import './StoryPlayer.css';

const StoryPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateBackground } = useContext(BackgroundContext);
  const { setProgress, clearProgress } = useProgress();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [showTree, setShowTree] = useState(false);
  const [error, setError] = useState(null);
  const choicesRef = useRef(null);

  const loadStory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await storyAPI.getById(id);
      setStory(response.data);
      
      // Будуємо початковий шлях (від кореня до останнього вузла без дітей)
      if (response.data.nodes.length > 0) {
        const nodes = response.data.nodes;
        const hasTreeLinks = nodes.some(n => n.parentNodeId);

        if (!hasTreeLinks) {
          // Legacy linear story: use original order
          setCurrentPath(nodes.map(n => n._id));
        } else {
          // Tree story: build a path from root to deepest reachable by following first children
          const buildInitialPath = () => {
            const path = [];
            const firstNode = nodes.find(n => !n.parentNodeId) || nodes[0];
            let current = firstNode;
            path.push(current._id);
            while (current) {
              const child = nodes.find(n => n.parentNodeId === current._id);
              if (child) {
                path.push(child._id);
                current = child;
              } else {
                break;
              }
            }
            return path;
          };

          setCurrentPath(buildInitialPath());
        }
      }

      // Обчислюємо прогрес (досліджені гілки / всі можливі вибори)
      try {
        const nodes = response.data.nodes || [];
        const explored = nodes.filter(n => n.parentNodeId).length;
        const totalChoices = nodes.reduce((acc, n) => acc + ((n.choices && n.choices.length) || 0), 0);
        const percent = totalChoices > 0 ? Math.min(100, Math.round((explored / totalChoices) * 100)) : 0;
        setProgress({ explored, totalChoices, percent });
      } catch {}
    } catch (error) {
      console.error('Помилка завантаження історії:', error);
      setError('Не вдалося завантажити історію');
    } finally {
      setLoading(false);
    }
  }, [id, updateBackground, setProgress]);

  // Refresh story without showing the global loading screen
  const refreshStorySilent = useCallback(async () => {
    try {
      const response = await storyAPI.getById(id);
      setStory(response.data);

      // Update progress stats
      try {
        const nodes = response.data.nodes || [];
        const explored = nodes.filter(n => n.parentNodeId).length; // each child node = explored choice
        const totalChoices = nodes.reduce((acc, n) => acc + ((n.choices && n.choices.length) || 0), 0);
        const percent = totalChoices > 0 ? Math.min(100, Math.round((explored / totalChoices) * 100)) : 0;
        setProgress({ explored, totalChoices, percent });
      } catch (e) {
        // ignore
      }

      return response;
    } catch (err) {
      console.error('Помилка оновлення історії:', err);
      setError('Не вдалося оновити історію');
      return null;
    }
  }, [id, updateBackground]);

  // Keep app background in sync with the currently selected path/node.
  useEffect(() => {
    if (!story || !Array.isArray(story.nodes) || currentPath.length === 0) return;
    const nodesById = new Map(story.nodes.map(n => [n._id, n]));
    // Prefer the current node image; fallback to the last image in the current path.
    const currentNode = nodesById.get(currentPath[currentPath.length - 1]);
    if (currentNode?.imageUrl) {
      updateBackground(currentNode.imageUrl);
      return;
    }

    for (let i = currentPath.length - 1; i >= 0; i--) {
      const node = nodesById.get(currentPath[i]);
      if (node?.imageUrl) {
        updateBackground(node.imageUrl);
        return;
      }
    }
  }, [story, currentPath, updateBackground]);

  useEffect(() => {
    loadStory();
    return () => {
      clearProgress();
    };
  }, [loadStory]);

  const handleChoice = async (choiceText, choiceIndex) => {
    setGenerating(true);

    try {
      const currentNodeId = currentPath[currentPath.length - 1];
      const currentNode = story.nodes.find(n => n._id === currentNodeId);

      // Перевіряємо, чи вже існує вузол з таким вибором
      const existingNode = story.nodes.find(n => {
        if (n.parentNodeId !== currentNodeId) return false;
        // Prefer matching by index if available (handles duplicated choice texts)
        if (typeof n.parentChoiceIndex === 'number') return n.parentChoiceIndex === choiceIndex;
        return n.parentChoiceText === choiceText;
      });

      if (existingNode) {
        // Якщо вузол вже існує, просто додаємо його до шляху
        setCurrentPath([...currentPath, existingNode._id]);
        setGenerating(false);
        
        setTimeout(() => {
          if (choicesRef.current) {
            choicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        return;
      }

      // Зберігаємо вибір користувача
      await storyAPI.saveChoice(id, {
        nodeId: currentNodeId,
        choiceText
      });

      const context = currentPath
        .map(nodeId => story.nodes.find(n => n._id === nodeId)?.content)
        .filter(Boolean)
        .join('\n\n');

      // Генеруємо продовження історії та зображення паралельно
      const [aiResponse, imageResponse] = await Promise.all([
        aiAPI.continue({
          previousContext: context,
          userChoice: choiceText,
          genre: story.genre,
          setting: story.setting,
          mainCharacter: story.mainCharacter
        }),
        aiAPI.generateImage({
          sceneDescription: `${story.mainCharacter} у ${story.setting}. Вибір: ${choiceText}`,
          genre: story.genre,
          setting: story.setting,
          style: 'cinematic'
        }).catch(err => {
          console.warn('Image generation failed:', err);
          return { data: { imageUrl: null } };
        })
      ]);

      // Persist inline base64 image as file if needed
      let imageUrl = imageResponse.data?.imageUrl || null;
      try {
        if (imageUrl && imageUrl.startsWith('data:')) {
          const upload = await api.post('/images/from-base64', { dataUrl: imageUrl });
          imageUrl = upload.data?.imageUrl || null;
        }
      } catch (e) {
        console.warn('Failed to persist base64 image, falling back to inline (not stored):', e?.message || e);
        // Do not store base64 in DB; drop it to avoid 16MB doc growth
        imageUrl = null;
      }

      // Додаємо новий вузол з контентом та (малим) URL зображенням
      const response = await storyAPI.addNode(id, {
        content: aiResponse.data.content,
        choices: aiResponse.data.choices,
        imageUrl,
        parentNodeId: currentNodeId,
        parentChoiceText: choiceText,
        parentChoiceIndex: choiceIndex
      });

      // Refresh story silently
      await refreshStorySilent();
      
      // Знаходимо новий вузол та додаємо його до шляху
      const newNode = response.data.nodes[response.data.nodes.length - 1];
      setCurrentPath([...currentPath, newNode._id]);
      
      // Плавний скролл до нових виборів після завантаження
      setTimeout(() => {
        if (choicesRef.current) {
          choicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    } catch (error) {
      console.error('Помилка продовження історії:', error);
      alert('Не вдалося продовжити історію. Спробуйте ще раз.');
    } finally {
      setGenerating(false);
    }
  };

  const handleNodeClick = (node) => {
    // Будуємо шлях від кореня до вибраного вузла, залишаючись у режимі дерева
    const buildPathToNode = (targetNodeId) => {
      const path = [];
      let current = story.nodes.find(n => n._id === targetNodeId);
      if (!current) return [];
      while (current) {
        path.unshift(current._id);
        if (current.parentNodeId) {
          current = story.nodes.find(n => n._id === current.parentNodeId);
        } else {
          break;
        }
      }
      return path;
    };
    const targetId = node._id || node.id;
    const newPath = buildPathToNode(targetId);
    if (newPath.length) {
      setCurrentPath(newPath);
    }
    // Не закриваємо дерево; лише плавно прокручуємо вибір у таймлайні якщо він відкритий
    if (!showTree) {
      setTimeout(() => {
        if (choicesRef.current) {
          choicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Ви впевнені, що хочете видалити цю історію?')) {
      try {
        await storyAPI.delete(id);
        navigate('/library');
      } catch (error) {
        console.error('Помилка видалення історії:', error);
        alert('Не вдалося видалити історію');
      }
    }
  };

  const handleExport = () => {
    if (!story) return;
    
    let text = `${story.title}\n`;
    text += `Жанр: ${story.genre}\n`;
    text += `Сеттінг: ${story.setting}\n`;
    text += `Головний персонаж: ${story.mainCharacter}\n\n`;
    text += '='.repeat(50) + '\n\n';
    
    // Експортуємо поточний пройдений шлях
    currentPath.forEach((nodeId, idx) => {
      const node = story.nodes.find(n => n._id === nodeId);
      if (!node) return;
      text += `Розділ ${idx + 1}\n`;
      text += '-'.repeat(30) + '\n';
      text += node.content + '\n\n';
      if (node.parentChoiceText) {
        text += `► Ваш вибір: ${node.parentChoiceText}\n\n`;
      }
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${story.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <LoadingSpinner message="Завантаження історії..." />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="error-screen">
        <h2>{error || 'Історію не знайдено'}</h2>
        <div className="error-actions">
          <button onClick={() => navigate('/')} className="btn btn-primary">
            <FaHome />
            На головну
          </button>
          <button onClick={loadStory} className="btn btn-secondary">
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  const currentNodeId = currentPath[currentPath.length - 1];
  const currentNode = story.nodes.find(n => n._id === currentNodeId);
  const nodesInPath = currentPath.map(nodeId => 
    story.nodes.find(n => n._id === nodeId)
  ).filter(Boolean);

  return (
    <div className="story-player">
      <div className="story-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>{story.title}</h1>
              <div className="story-meta">
                <span className="genre-badge">{story.genre}</span>
                <span className="separator">•</span>
                <span>{story.nodes.length} {story.nodes.length === 1 ? 'вузол' : 'вузлів'}</span>
                <span className="separator">•</span>
                <span>Крок {currentPath.length}</span>
              </div>
            </div>
            <div className="header-actions">
              <button 
                onClick={() => setShowTree(!showTree)} 
                className={`btn btn-icon ${showTree ? 'active' : ''}`}
                title="Дерево рішень"
              >
                <FaProjectDiagram />
              </button>
              <button 
                onClick={handleExport} 
                className="btn btn-icon"
                title="Експортувати історію"
              >
                <FaDownload />
              </button>
              <button 
                onClick={() => navigate('/library')} 
                className="btn btn-icon"
                title="До бібліотеки"
              >
                <FaHome />
              </button>
              <button 
                onClick={handleDelete} 
                className="btn btn-icon btn-danger"
                title="Видалити історію"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="story-content">
        <AnimatePresence mode="wait">
          {showTree ? (
            <motion.div
              key="tree"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StoryTree 
                nodes={story.nodes} 
                currentPath={currentPath}
                onNodeClick={handleNodeClick}
              />
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="story-timeline">
                {nodesInPath.map((node, index) => (
                  <motion.div
                    key={node._id}
                    className={`timeline-node ${index === nodesInPath.length - 1 ? 'active' : 'past'}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="node-number">{index + 1}</div>
                    <div className="node-content">
                      {node.imageUrl && (
                        <div className="node-image">
                          <img src={node.imageUrl} alt={`Ілюстрація розділу ${index + 1}`} />
                        </div>
                      )}
                      <p className="node-text">{node.content}</p>
                      
                      {node.parentChoiceText && (
                        <div className="user-choice">
                          <span className="choice-label">Ваш вибір:</span>
                          <span className="choice-text">{node.parentChoiceText}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {!generating && currentNode && currentNode.choices && currentNode.choices.length > 0 && (
                  <motion.div
                    ref={choicesRef}
                    className="choices-container"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <h3>Що ви зробите далі?</h3>
                    <div className="choices-grid">
                      {currentNode.choices.map((choice, index) => {
                        const existingNode = story.nodes.find(
                          n => n.parentNodeId === currentNodeId && n.parentChoiceText === choice
                        );
                        
                        return (
                          <motion.button
                            key={index}
                            className={`choice-button ${existingNode ? 'explored' : ''}`}
                            onClick={() => handleChoice(choice, index)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <span className="choice-number">{index + 1}</span>
                            <span className="choice-content">{choice}</span>
                            {existingNode && (
                              <span className="choice-badge">Досліджено</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {generating && (
                <motion.div
                  className="generating-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <FaSpinner className="spinner large" />
                  <p>AI створює продовження історії...</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StoryPlayer;
