import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './StoryTree.css';

const StoryTree = ({ nodes, currentPath, onNodeClick }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tree, setTree] = useState(null);
  const [positions, setPositions] = useState({});
  const [viewMode, setViewMode] = useState('tree');
  const [expanded, setExpanded] = useState(() => new Set());
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);

  const pathSet = useMemo(() => new Set(currentPath || []), [currentPath]);

  // Build tree structure
  useEffect(() => {
    if (!nodes || nodes.length === 0) return;
    
    const nodeMap = new Map();
    const roots = [];
    
    nodes.forEach((node, index) => {
      const nodeData = {
        id: node._id,
        index,
        content: node.content,
        imageUrl: node.imageUrl,
        children: [],
        parentId: node.parentNodeId,
        choiceText: node.parentChoiceText,
        choices: node.choices || []
      };
      nodeMap.set(node._id, nodeData);
    });

    nodes.forEach((node) => {
      const nodeData = nodeMap.get(node._id);
      if (node.parentNodeId && nodeMap.has(node.parentNodeId)) {
        const parent = nodeMap.get(node.parentNodeId);
        parent.children.push(nodeData);
      } else {
        roots.push(nodeData);
      }
    });

    const treeData = roots.length > 0 ? roots[0] : null;
    setTree(treeData);

    if (treeData) {
      setExpanded(new Set([treeData.id]));
    }
  }, [nodes]);

  // Calculate tree layout (improved Reingold-Tilford algorithm)
  useEffect(() => {
    if (!tree) return;

    const LEVEL_HEIGHT = 200;
    const NODE_WIDTH = 160;
    const SIBLING_DISTANCE = 40;
    const SUBTREE_DISTANCE = 60;

    const firstWalk = (node, depth = 0) => {
      node.depth = depth;
      
      if (!node.children || node.children.length === 0) {
        node.prelim = 0;
        node.modifier = 0;
        return;
      }

      node.children.forEach((child, i) => {
        firstWalk(child, depth + 1);
      });

      const leftChild = node.children[0];
      const rightChild = node.children[node.children.length - 1];
      const midpoint = (leftChild.prelim + rightChild.prelim) / 2;

      node.prelim = midpoint;
      node.modifier = 0;
    };

    const secondWalk = (node, modSum = 0, positions = {}) => {
      const x = node.prelim + modSum;
      const y = node.depth * LEVEL_HEIGHT;
      
      positions[node.id] = { x, y };

      if (node.children) {
        let childModSum = modSum + node.modifier;
        
        // Distribute children evenly
        const totalWidth = (node.children.length - 1) * (NODE_WIDTH + SIBLING_DISTANCE);
        let startX = x - totalWidth / 2;
        
        node.children.forEach((child, i) => {
          child.prelim = startX + i * (NODE_WIDTH + SIBLING_DISTANCE) - x;
          secondWalk(child, childModSum, positions);
        });
      }

      return positions;
    };


    firstWalk(tree);
    const pos = secondWalk(tree);

    // Collision resolution: ensure nodes on the same depth/level do not horizontally overlap.
    // We shift overlapping subtrees to the right while preserving parent->child relative layout.
    const nodeLookup = {};
    const buildLookup = (n) => {
      nodeLookup[n.id] = n;
      if (n.children) n.children.forEach(buildLookup);
    };
    buildLookup(tree);

    // Group node ids by their computed depth
    const nodesByDepth = {};
    Object.keys(pos).forEach((id) => {
      const depth = (nodeLookup[id] && nodeLookup[id].depth) || 0;
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(id);
    });

    const minSpacing = NODE_WIDTH + SIBLING_DISTANCE; // minimum center-to-center spacing baseline

    // Iterative pairwise relaxation per depth: if neighbors are too close, push them apart evenly.
    const depths = Object.keys(nodesByDepth).map(d => Number(d)).sort((a, b) => a - b);

    // helper: shift an entire subtree by amount (updates pos)
    const shiftSubtreeById = (id, amount) => {
      const root = nodeLookup[id];
      if (!root) return;
      const _shift = (n) => {
        if (!pos[n.id]) return;
        pos[n.id].x += amount;
        if (n.children) n.children.forEach(_shift);
      };
      _shift(root);
    };

    // compute subtree bounding boxes (min/max) from current pos
    const computeBBoxes = (() => {
      const bboxes = {};
      const dfs = (n) => {
        if (!pos[n.id]) {
          // fallback to 0
          bboxes[n.id] = { min: 0, max: 0 };
          return bboxes[n.id];
        }
        let min = pos[n.id].x - NODE_WIDTH / 2;
        let max = pos[n.id].x + NODE_WIDTH / 2;
        if (n.children && n.children.length > 0) {
          n.children.forEach(ch => {
            const cb = dfs(ch);
            if (cb) {
              if (cb.min < min) min = cb.min;
              if (cb.max > max) max = cb.max;
            }
          });
        }
        bboxes[n.id] = { min, max };
        return bboxes[n.id];
      };
      return (root) => {
        dfs(root);
        return bboxes;
      };
    })();

    // Run several global iterations: relax overlaps based on subtree bboxes, then recenter parents.
    const MAX_GLOBAL_ITERS = 4;
    for (let gi = 0; gi < MAX_GLOBAL_ITERS; gi++) {
      const bboxes = computeBBoxes(tree);

      // Relax per depth using up-to-date subtree bboxes
      depths.forEach(depth => {
        let stable = false;
        const MAX_DEPTH_ITERS = 30;
        for (let di = 0; di < MAX_DEPTH_ITERS && !stable; di++) {
          stable = true;
          // build working list from current bboxes
          const list = nodesByDepth[depth].map(id => ({ id, min: bboxes[id].min, max: bboxes[id].max, center: (bboxes[id].min + bboxes[id].max) / 2 }));
          list.sort((a, b) => a.center - b.center);

          for (let i = 1; i < list.length; i++) {
            const left = list[i - 1];
            const right = list[i];
            const gap = right.min - left.max;
            if (gap < SIBLING_DISTANCE) {
              const overlap = SIBLING_DISTANCE - gap;
              const leftShift = -overlap / 2;
              const rightShift = overlap / 2;

              // apply shifts to subtrees
              shiftSubtreeById(left.id, leftShift);
              shiftSubtreeById(right.id, rightShift);

              // recompute bboxes globally and mark not stable to repeat
              Object.assign(bboxes, computeBBoxes(tree));
              stable = false;
              break; // restart this depth iteration using updated bboxes
            }
          }
        }
      });

      // Re-centering pass: for each non-leaf node, nudge the parent towards the centroid of its immediate children
      const recentreNodes = (n) => {
        if (!n.children || n.children.length === 0) return;
        n.children.forEach(recentreNodes);
        const childXs = n.children.map(ch => pos[ch.id].x);
        if (childXs.length === 0) return;
        const avg = childXs.reduce((s, v) => s + v, 0) / childXs.length;
        const shift = (avg - pos[n.id].x) * 0.8;
        if (Math.abs(shift) > 0.0001) pos[n.id].x += shift;
      };
      recentreNodes(tree);
    }

    // Re-centering pass: for each non-leaf node, nudge the parent towards the centroid of its immediate children
    // This keeps the tree compact after relaxation while preserving child relative positions.
    const recentreNodes = (n) => {
      if (!n.children || n.children.length === 0) return;
      // process children first (post-order)
      n.children.forEach(recentreNodes);

      // compute average x of immediate children
      const childXs = n.children.map(ch => pos[ch.id].x);
      if (childXs.length === 0) return;
      const avg = childXs.reduce((s, v) => s + v, 0) / childXs.length;

      // move parent a fraction toward the average to avoid large jumps (0.8 allows strong centering)
      const shift = (avg - pos[n.id].x) * 0.8;
      if (Math.abs(shift) > 0.0001) {
        pos[n.id].x += shift;
      }
    };

    recentreNodes(tree);

    setPositions(pos);

    // Auto-center on mount
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTransform({ 
        x: rect.width / 2, 
        y: 60, 
        scale: 0.85 
      });
    }
  }, [tree]);

  // List mode rendering
  const renderList = (node, depth = 0) => {
    if (!node) return null;
    const isInPath = pathSet.has(node.id);
    const isCurrent = currentPath[currentPath.length - 1] === node.id;
    const isExpanded = expanded.has(node.id);
    
    const toggle = (e) => {
      e.stopPropagation();
      setExpanded(prev => {
        const next = new Set([...prev]);
        if (next.has(node.id)) next.delete(node.id); 
        else next.add(node.id);
        return next;
      });
    };

    return (
      <li key={node.id} className={`list-node ${isInPath ? 'in-path' : ''} ${isCurrent ? 'current' : ''}`}> 
        <div className="list-node-header" onClick={() => onNodeClick && onNodeClick(node)}>
          <button className="list-node-expander" onClick={toggle} aria-label={isExpanded ? 'Згорнути' : 'Розгорнути'}>
            {node.children?.length ? (isExpanded ? '−' : '+') : '•'}
          </button>
          {node.imageUrl && <img className="list-node-thumb" src={node.imageUrl} alt="Scene" />}
          <div className="list-node-main">
            <div className="list-node-line">
              <span className="badge index">{node.index + 1}</span>
              {node.choiceText && <span className="choice-text" title={node.choiceText}>{node.choiceText}</span>}
            </div>
            {node.choices?.length > 0 && (
              <div className="list-node-meta">{node.choices.length} {node.choices.length === 1 ? 'вибір' : 'вибори'}</div>
            )}
          </div>
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <ul className="list-children">
            {node.children.map(ch => renderList(ch, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  // Tree SVG rendering
  const renderConnections = () => {
    if (!tree || Object.keys(positions).length === 0) return null;

    const lines = [];
    const traverse = (node) => {
      if (!node.children) return;
      
      const parentPos = positions[node.id];
      if (!parentPos) return;

      node.children.forEach((child, i) => {
        const childPos = positions[child.id];
        if (!childPos) return;

        const isInPath = pathSet.has(node.id) && pathSet.has(child.id);
        const isCurrent = currentPath[currentPath.length - 1] === child.id && 
                         currentPath[currentPath.length - 2] === node.id;

        // Curved path for elegance
        const x1 = parentPos.x;
        const y1 = parentPos.y + 75; // bottom of parent card
        const x2 = childPos.x;
        const y2 = childPos.y - 10; // top of child card
        
        const midY = (y1 + y2) / 2;
        const path = `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`;

        lines.push(
          <g key={`${node.id}-${child.id}`}>
            {/* subtle blurred glow behind the connection to make branches pop */}
            <motion.path
              d={path}
              stroke={isCurrent ? 'rgba(168,85,247,0.35)' : isInPath ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.08)'}
              strokeWidth={isCurrent ? 10 : isInPath ? 8 : 6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'url(#line-glow)' }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isInPath || isCurrent ? 0.9 : 0.6 }}
              transition={{ duration: 0.5, delay: node.depth * 0.08 }}
            />
            {/* main visible connection */}
            <motion.path
              d={path}
              stroke={isCurrent ? 'url(#gradient-current)' : isInPath ? 'url(#gradient-path)' : 'rgba(99, 102, 241, 0.22)'}
              strokeWidth={isCurrent ? 5 : isInPath ? 3.5 : 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: node.depth * 0.09 }}
            />
            {/* Branch number badge */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: node.depth * 0.1 + 0.3 }}
            >
              <circle
                cx={(x1 + x2) / 2}
                cy={(y1 + y2) / 2}
                r="14"
                fill="rgba(15, 23, 42, 0.95)"
                stroke={isInPath ? 'rgba(139, 92, 246, 0.8)' : 'rgba(99, 102, 241, 0.5)'}
                strokeWidth="2"
              />
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize="11"
                fontWeight="700"
              >
                {i + 1}
              </text>
            </motion.g>
          </g>
        );

        traverse(child);
      });
    };

    traverse(tree);
    return lines;
  };

  const renderTreeNodes = (node) => {
    if (!node) return null;
    const pos = positions[node.id];
    if (!pos) return null;

    const isInPath = pathSet.has(node.id);
    const isCurrent = currentPath[currentPath.length - 1] === node.id;
    const isHovered = hoveredNode === node.id;

    return (
      <React.Fragment key={node.id}>
        <motion.g
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: node.depth * 0.1 }}
          style={{ cursor: 'pointer' }}
          onClick={() => onNodeClick && onNodeClick(node)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
        >
          {/* Card background with glow */}
          <defs>
            <filter id={`glow-${node.id}`}>
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id={`card-gradient-${node.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isCurrent ? 'rgba(139, 92, 246, 0.3)' : 'rgba(99, 102, 241, 0.15)'} />
              <stop offset="100%" stopColor={isCurrent ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 41, 59, 0.9)'} />
            </linearGradient>
          </defs>
          
          {/* Outer glow for current node */}
          {isCurrent && (
            <rect
              x={pos.x - 85}
              y={pos.y - 15}
              width="170"
              height="160"
              rx="18"
              fill="none"
              stroke="rgba(168, 85, 247, 0.6)"
              strokeWidth="2"
              filter={`url(#glow-${node.id})`}
            />
          )}

          {/* Main card */}
          <rect
            x={pos.x - 80}
            y={pos.y - 10}
            width="160"
            height="150"
            rx="16"
            fill={`url(#card-gradient-${node.id})`}
            stroke={isCurrent ? 'rgba(168, 85, 247, 0.8)' : isInPath ? 'rgba(99, 102, 241, 0.6)' : 'rgba(99, 102, 241, 0.3)'}
            strokeWidth={isCurrent ? 3 : 2}
            style={{
              filter: isHovered ? 'brightness(1.2)' : 'brightness(1)',
              transition: 'filter 0.2s'
            }}
          />

          {/* Image */}
          {node.imageUrl && (
            <image
              href={node.imageUrl}
              x={pos.x - 75}
              y={pos.y - 5}
              width="150"
              height="80"
              clipPath={`inset(0 0 0 0 round 12px 12px 0 0)`}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Node number badge */}
          <circle
            cx={pos.x}
            cy={pos.y + (node.imageUrl ? 90 : 30)}
            r="20"
            fill="url(#gradient-badge)"
          />
          <text
            x={pos.x}
            y={pos.y + (node.imageUrl ? 90 : 30)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize="14"
            fontWeight="800"
          >
            {node.index + 1}
          </text>

          {/* Choice text */}
          {node.choiceText && (
            <text
              x={pos.x}
              y={pos.y + (node.imageUrl ? 112 : 52)}
              textAnchor="middle"
              fill="rgba(241, 245, 249, 0.9)"
              fontSize="10"
              fontStyle="italic"
              style={{ maxWidth: '140px' }}
            >
              {node.choiceText.length > 25 ? node.choiceText.substring(0, 25) + '…' : node.choiceText}
            </text>
          )}

          {/* Choices count */}
          {node.choices && node.choices.length > 0 && (
            <>
              <rect
                x={pos.x - 80}
                y={pos.y + 125}
                width="160"
                height="15"
                fill="rgba(99, 102, 241, 0.25)"
              />
              <text
                x={pos.x}
                y={pos.y + 132}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(99, 102, 241, 1)"
                fontSize="9"
                fontWeight="700"
              >
                {node.choices.length} {node.choices.length === 1 ? 'вибір' : 'вибори'}
              </text>
            </>
          )}
        </motion.g>
        {node.children && node.children.map(child => renderTreeNodes(child))}
      </React.Fragment>
    );
  };

  const handleWheel = (e) => {
    if (viewMode !== 'tree') return;
    e.preventDefault();
    
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.3, transform.scale + delta), 2);
    
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e) => {
    if (viewMode !== 'tree' || e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTransform({ x: rect.width / 2, y: 60, scale: 0.85 });
    }
  };

  if (!tree) {
    return (
      <div className="story-tree-empty">
        <p>Почніть історію, щоб побачити дерево рішень</p>
      </div>
    );
  }

  // Calculate SVG dimensions
  const allY = Object.values(positions).map(p => p.y);
  const allX = Object.values(positions).map(p => p.x);
  const minX = Math.min(...allX) - 200;
  const maxX = Math.max(...allX) + 200;
  const minY = -50;
  const maxY = Math.max(...allY) + 200;

  return (
    <div className="story-tree">
      <div className="view-mode-bar">
        <div className="view-mode-buttons">
          <button
            className={viewMode === 'tree' ? 'active' : ''}
            onClick={() => setViewMode('tree')}
          >
            🌳 Дерево
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            📋 Список
          </button>
        </div>
        {viewMode === 'tree' && (
          <div className="tree-controls">
            <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(2, p.scale * 1.2) }))}>
              🔍+
            </button>
            <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale / 1.2) }))}>
              🔍−
            </button>
            <button onClick={resetView}>⟲</button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            className="story-tree-list-wrapper"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <ul className="story-tree-list" role="tree">
              {renderList(tree)}
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="tree"
            className="tree-svg-container"
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="600"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient id="gradient-current" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(168, 85, 247, 1)" />
                  <stop offset="100%" stopColor="rgba(139, 92, 246, 0.6)" />
                </linearGradient>
                <linearGradient id="gradient-path" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(99, 102, 241, 0.8)" />
                  <stop offset="100%" stopColor="rgba(99, 102, 241, 0.4)" />
                </linearGradient>
                <linearGradient id="gradient-badge" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
              <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                {renderConnections()}
                {renderTreeNodes(tree)}
              </g>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoryTree;
