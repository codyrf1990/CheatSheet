let dragged = null;
let dragOver = null;
let dropTarget = null;
let dragSource = null;

function onDragStart(event) {
   dragged = event.currentTarget;
   dragged.classList.add('dragging');
   dragSource = dragged.closest('[data-sortable-group]');

   // Get drag data for better drop handling
   event.dataTransfer.effectAllowed = 'move';
   event.dataTransfer.setData('text/plain', dragged.dataset.bit || '');

   // Show invalid drop zones
   updateDropZoneVisuals();
}

function onDragOver(event) {
   if (!dragged || event.currentTarget === dragged) return;

   event.preventDefault();
   event.dataTransfer.dropEffect = canDropHere(event.currentTarget) ? 'move' : 'none';

   // Clear previous placeholder
   document.querySelectorAll('.placeholder').forEach(el => {
     if (el !== event.currentTarget) el.classList.remove('placeholder');
   });

   // Add placeholder to current target if valid
   if (canDropHere(event.currentTarget)) {
     event.currentTarget.classList.add('placeholder');
     dragOver = event.currentTarget;
   }
}

function onDragEnter(event) {
   if (!dragged || event.currentTarget === dragged) return;

   const target = event.currentTarget;
   const container = target.closest('[data-sortable-group]');

   if (canDropHere(target)) {
     dropTarget = container;
     container?.classList.add('drop-target');
   }
}

function onDragLeave(event) {
   const target = event.currentTarget;
   const container = target.closest('[data-sortable-group]');

   // Only remove classes if we're actually leaving the container
   if (!container?.contains(event.relatedTarget)) {
     target.classList.remove('placeholder');
     container?.classList.remove('drop-target');
     if (dragOver === target) dragOver = null;
   }
}

function onDragEnd(event) {
   // Clean up all visual states
   document.querySelectorAll('.placeholder, .drop-target, .drop-invalid').forEach(node => {
     node.classList.remove('placeholder', 'drop-target', 'drop-invalid');
   });

   // Handle the drop if we have a valid target
   if (dragged && dragOver && dropTarget && canDropHere(dragOver)) {
     handleDrop(dragged, dragOver, dropTarget);
   }

   // Reset state
   dragged.classList.remove('dragging');
   dragged = null;
   dragOver = null;
   dropTarget = null;
   dragSource = null;
}

function onContainerDragOver(event) {
   if (!dragged || !canDropHere(event.currentTarget)) return;
   event.preventDefault();
   event.dataTransfer.dropEffect = 'move';
}

function onContainerDragEnter(event) {
   if (!dragged || !canDropHere(event.currentTarget)) return;
   event.currentTarget.classList.add('drop-target');
}

function onContainerDrop(event) {
   if (!dragged || !canDropHere(event.currentTarget)) return;

   event.preventDefault();
   const container = event.currentTarget;

   // If no specific dragOver target, append to container
   if (!dragOver) {
     container.appendChild(dragged);
     dispatchDropEvent(dragged, dragSource, container);
   }

   container.classList.remove('drop-target');
}

function onContainerDragLeave(event) {
   const container = event.currentTarget;
   if (container.contains(event.relatedTarget)) return;
   container.classList.remove('drop-target');
}

function canDropHere(target) {
   if (!dragged || !target) return false;

   // Don't drop on self
   if (target === dragged) return false;

   // Find the container for this target
   const targetContainer = target.closest('[data-sortable-group]');
   if (!targetContainer) return false;

   // If dragging from a container, check scope compatibility
   if (dragSource) {
     const sourceScope = dragSource.dataset.sortableScope || dragSource.dataset.sortableGroup;
     const targetScope = targetContainer.dataset.sortableScope || targetContainer.dataset.sortableGroup;

     // Allow drop if:
     // 1. Scopes match exactly
     if (sourceScope && targetScope && sourceScope === targetScope) return true;

     // 2. One of the scopes is undefined or empty (unscoped container)
     if (!sourceScope || !targetScope) return true;

     // 3. Both containers are package scopes
     const packageScopes = ['package-bits', 'standalone-modules', 'maintenance-skus'];
     if (packageScopes.includes(sourceScope) && packageScopes.includes(targetScope)) return true;

     return false;
   }

   return true;
}

function updateDropZoneVisuals() {
   document.querySelectorAll('.drop-invalid').forEach(el => {
     el.classList.remove('drop-invalid');
   });

   // Mark invalid drop zones only for truly incompatible scopes
   if (dragged && dragSource) {
     const sourceScope = dragSource.dataset.sortableScope || dragSource.dataset.sortableGroup;
     const packageScopes = ['package-bits', 'standalone-modules', 'maintenance-skus'];

     document.querySelectorAll('[data-sortable-group]').forEach(container => {
       if (container === dragSource) return;

       const targetScope = container.dataset.sortableScope || container.dataset.sortableGroup;

       // Mark as invalid only if both have scopes and they're truly incompatible
       if (sourceScope && targetScope) {
         const sourceIsPackage = packageScopes.includes(sourceScope);
         const targetIsPackage = packageScopes.includes(targetScope);

         // Only invalidate if one is package-related and the other isn't
         if ((sourceIsPackage && !targetIsPackage) || (!sourceIsPackage && targetIsPackage)) {
           container.classList.add('drop-invalid');
         }
       }
     });
   }
}

function handleDrop(item, target, container) {
   const isSameContainer = item.parentElement === container;
   const isReordering = isSameContainer && target;

   if (isReordering) {
     // Simple reordering within same container
     if (item.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
       container.insertBefore(item, target.nextSibling);
     } else {
       container.insertBefore(item, target);
     }
   } else {
     // Moving to different container
     if (target) {
       container.insertBefore(item, target);
     } else {
       container.appendChild(item);
     }
   }

   // Add success animation
   item.classList.add('drop-success');
   setTimeout(() => {
     item.classList.remove('drop-success');
   }, 600);

   // Dispatch event for application logic
   dispatchDropEvent(item, dragSource, container);
}

function dispatchDropEvent(item, from, to) {
   if (!item || !to) return;
   const detail = { item, from, to };
   const event = new CustomEvent('sortable:drop', { bubbles: true, detail });
   to.dispatchEvent(event);
}

function bindItem(item) {
   if (item.dataset.dragBound === 'true') return;

   item.draggable = true;
   item.classList.add('draggable');
   item.dataset.dragBound = 'true';

   item.addEventListener('dragstart', onDragStart);
   item.addEventListener('dragover', onDragOver);
   item.addEventListener('dragenter', onDragEnter);
   item.addEventListener('dragleave', onDragLeave);
   item.addEventListener('dragend', onDragEnd);
}

function unbindItem(item) {
   item.draggable = false;
   item.classList.remove('draggable', 'dragging', 'placeholder');
   delete item.dataset.dragBound;

   item.removeEventListener('dragstart', onDragStart);
   item.removeEventListener('dragover', onDragOver);
   item.removeEventListener('dragenter', onDragEnter);
   item.removeEventListener('dragleave', onDragLeave);
   item.removeEventListener('dragend', onDragEnd);
}

function bindContainer(container) {
   if (container.dataset.dragContainerBound === 'true') return;

   container.dataset.dragContainerBound = 'true';
   container.addEventListener('dragover', onContainerDragOver);
   container.addEventListener('dragenter', onContainerDragEnter);
   container.addEventListener('drop', onContainerDrop);
   container.addEventListener('dragleave', onContainerDragLeave);
}

function unbindContainer(container) {
   delete container.dataset.dragContainerBound;
   container.removeEventListener('dragover', onContainerDragOver);
   container.removeEventListener('dragenter', onContainerDragEnter);
   container.removeEventListener('drop', onContainerDrop);
   container.removeEventListener('dragleave', onContainerDragLeave);
}

function collectNodes(root, selector) {
  const nodes = [];
  if (root instanceof Element && root.matches(selector)) {
    nodes.push(root);
  }
  if (root && typeof root.querySelectorAll === 'function') {
    nodes.push(...root.querySelectorAll(selector));
  }
  return nodes;
}

export function enableDrag(root) {
  collectNodes(root, '[data-sortable-item]').forEach(bindItem);
  collectNodes(root, '[data-sortable-group]').forEach(bindContainer);
}

export function disableDrag(root) {
  collectNodes(root, '[data-sortable-item]').forEach(unbindItem);
  collectNodes(root, '[data-sortable-group]').forEach(unbindContainer);
}
